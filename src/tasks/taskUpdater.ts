import { App, TFile } from 'obsidian';
import { GanttTask } from '../types';

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(date: Date, format: string): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');

	return format.replace('YYYY', String(year))
		.replace('MM', month)
		.replace('DD', day);
}

/**
 * 在任务行中修改单个日期字段（辅助函数）
 * @param taskLine 原始任务行
 * @param dateFieldName 日期字段名 (dueDate, startDate 等)
 * @param newDate 新日期值 (null 表示移除该字段)
 * @param format 格式 ('dataview' | 'tasks')
 * @returns 修改后的任务行
 */
function modifyDateInLine(
	taskLine: string,
	dateFieldName: string,
	newDate: Date | null,
	format: 'dataview' | 'tasks'
): string {
	const fieldMap: Record<string, string> = {
		dueDate: 'due',
		startDate: 'start',
		scheduledDate: 'scheduled',
		createdDate: 'created',
		cancelledDate: 'cancelled',
		completionDate: 'completion',
	};
	const emojiMap: Record<string, string> = {
		dueDate: '📅',
		startDate: '🛫',
		scheduledDate: '⏳',
		createdDate: '➕',
		cancelledDate: '❌',
		completionDate: '✅',
	};

	if (format === 'dataview') {
		const fieldKey = fieldMap[dateFieldName];
		if (!fieldKey) return taskLine;

		// 移除旧值
		const re = new RegExp(`\\[${fieldKey}::\\s*[^\\]]+\\]`, 'g');
		taskLine = taskLine.replace(re, '');

		// 添加新值（非 null）
		if (newDate !== null) {
			const dateStr = formatDate(newDate, 'YYYY-MM-DD');
			taskLine = taskLine.trimEnd() + ` [${fieldKey}:: ${dateStr}]`;
		}
	} else {
		// Tasks 格式
		const emoji = emojiMap[dateFieldName];
		if (!emoji) return taskLine;

		// 移除旧值
		const re = new RegExp(`${emoji}\\s*\\d{4}-\\d{2}-\\d{2}`, 'g');
		taskLine = taskLine.replace(re, '');

		// 添加新值（非 null）
		if (newDate !== null) {
			const dateStr = formatDate(newDate, 'YYYY-MM-DD');
			taskLine = taskLine.trimEnd() + ` ${emoji} ${dateStr}`;
		}
	}

	return taskLine;
}

/**
 * 确定任务使用的格式
 */
function determineTaskFormat(
	task: GanttTask,
	taskLine: string,
	enabledFormats: string[]
): 'dataview' | 'tasks' {
	// 优先使用任务本身的格式
	let formatToUse: 'dataview' | 'tasks' | undefined = task.format;
	if (!formatToUse) {
		if (/\[(priority|created|start|scheduled|due|cancelled|completion)::\s*[^\]]+\]/.test(taskLine)) {
			formatToUse = 'dataview';
		} else if (/([➕🛫⏳📅❌✅])\s*\d{4}-\d{2}-\d{2}/.test(taskLine)) {
			formatToUse = 'tasks';
		} else if (enabledFormats.includes('dataview') && enabledFormats.includes('tasks')) {
			// 两者都支持时：如果行中已有方括号则 dataview，否则 tasks
			formatToUse = taskLine.includes('[') ? 'dataview' : 'tasks';
		} else if (enabledFormats.includes('dataview')) {
			formatToUse = 'dataview';
		} else {
			formatToUse = 'tasks';
		}
	}
	return formatToUse;
}

/**
 * 读取任务行并返回文件内容和行索引
 */
async function readTaskLine(app: App, task: GanttTask): Promise<{ file: TFile; content: string; lines: string[]; taskLineIndex: number }> {
	const file = app.vault.getAbstractFileByPath(task.filePath);
	if (!(file instanceof TFile)) {
		throw new Error(`File not found: ${task.filePath}`);
	}

	const content = await app.vault.read(file);
	const lines = content.split('\n');

	// 获取任务行的索引（lineNumber 是 1-based）
	const taskLineIndex = task.lineNumber - 1;
	if (taskLineIndex < 0 || taskLineIndex >= lines.length) {
		throw new Error(`Invalid line number: ${task.lineNumber}`);
	}

	return { file, content, lines, taskLineIndex };
}

/**
 * 更新任务的完成状态
 * @param app Obsidian App 实例
 * @param task 要更新的任务
 * @param completed 是否完成
 * @param enabledFormats 启用的任务格式
 */
export async function updateTaskCompletion(
	app: App,
	task: GanttTask,
	completed: boolean,
	enabledFormats: string[]
): Promise<void> {
	const { file, lines, taskLineIndex } = await readTaskLine(app, task);
	let taskLine = lines[taskLineIndex];

	// 更新复选框状态
	taskLine = taskLine.replace(/\[([ xX])\]/, completed ? '[x]' : '[ ]');

	// 处理完成日期
	const today = formatDate(new Date(), 'YYYY-MM-DD');
	const formatToUse = determineTaskFormat(task, taskLine, enabledFormats);

	if (completed) {
		// 添加完成日期
		if (formatToUse === 'dataview') {
			taskLine = taskLine.replace(/\[completion::\s*[^\]]+\]/g, '');
			taskLine = taskLine.trimEnd() + ` [completion:: ${today}]`;
		} else {
			taskLine = taskLine.replace(/✅\s*\d{4}-\d{2}-\d{2}/g, '');
			taskLine = taskLine.trimEnd() + ` ✅ ${today}`;
		}
	} else {
		// 移除完成日期
		taskLine = taskLine.replace(/\[completion::\s*[^\]]+\]\s*/g, '');
		taskLine = taskLine.replace(/✅\s*\d{4}-\d{2}-\d{2}\s*/g, '');
	}

	// 更新内容
	lines[taskLineIndex] = taskLine;
	const newContent = lines.join('\n');

	// 写入文件
	await app.vault.modify(file, newContent);
}

/**
 * 更新任务的日期字段（由日期筛选字段指定）
 * @param app Obsidian App
 * @param task 任务对象
 * @param dateFieldName 日期字段名（dueDate, startDate, scheduledDate, createdDate, cancelledDate, completionDate）
 * @param newDate 新的日期值
 * @param enabledFormats 启用的任务格式
 */
export async function updateTaskDateField(
	app: App,
	task: GanttTask,
	dateFieldName: string,
	newDate: Date,
	enabledFormats: string[]
): Promise<void> {
	const { file, lines, taskLineIndex } = await readTaskLine(app, task);
	let taskLine = lines[taskLineIndex];

	const formatToUse = determineTaskFormat(task, taskLine, enabledFormats);

	// 使用辅助函数修改日期字段
	taskLine = modifyDateInLine(taskLine, dateFieldName, newDate, formatToUse);

	// 更新内容
	lines[taskLineIndex] = taskLine;
	const newContent = lines.join('\n');

	// 写入文件
	await app.vault.modify(file, newContent);
}

/**
 * 批量更新任务属性（优先级、完成状态、各日期字段）
 * 未提供的字段不做更改；传入 null 的日期字段表示清除该字段。
 */
export async function updateTaskProperties(
	app: App,
	task: GanttTask,
	updates: {
		completed?: boolean;
		priority?: 'highest' | 'high' | 'medium' | 'low' | 'lowest' | 'normal' | undefined;
		createdDate?: Date | null;
		startDate?: Date | null;
		scheduledDate?: Date | null;
		dueDate?: Date | null;
		cancelledDate?: Date | null;
		completionDate?: Date | null;
		content?: string;
		globalFilter?: string;
	},
	enabledFormats: string[]
): Promise<void> {
	const { file, lines, taskLineIndex } = await readTaskLine(app, task);
	let taskLine = lines[taskLineIndex];

	// 支持修改任务描述（content 字段）
	// 注意：修改描述时，所有元数据（优先级、日期等）会在后续循环中重新添加
	// 因此这里只需更新描述文本，移除所有元数据标记即可
	const contentModified = typeof updates.content === 'string' && updates.content.trim() !== '' && updates.content !== task.content;
	if (contentModified) {
		// 匹配任务行前缀（- [ ]/x + 可能的全局筛选）
		const m = taskLine.match(/^(\s*[-*]\s*\[[ xX]\]\s*)(.*)$/);
		if (m) {
			const prefix = m[1];
			let rest = m[2];
			// 检查并保留原有全局过滤标志
			let gfPrefix = '';
			const globalFilter = updates.globalFilter || '';
			if (globalFilter) {
				const gf = (globalFilter + '').trim();
				if (gf && rest.trim().startsWith(gf)) {
					gfPrefix = gf + ' ';
					rest = rest.trim().slice(gf.length).trim();
				}
			}
			// 移除所有元数据标记（优先级、日期emoji+日期值、dataview字段、wiki链接）
			// 这些元数据会在后续的日期/优先级处理循环中重新添加
			rest = rest.replace(/\s*(🔺|⏫|🔼|🔽|⏬)\s*/g, ' ');
			rest = rest.replace(/\s*(➕|🛫|⏳|📅|❌|✅)\s*\d{4}-\d{2}-\d{2}\s*/g, ' ');
			rest = rest.replace(/\s*\[(priority|created|start|scheduled|due|cancelled|completion)::[^\]]+\]\s*/g, ' ');
			rest = rest.replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, ' ');
			rest = rest.replace(/\s{2,}/g, ' ').trim();

			// 重新拼接任务行，使用新的描述内容
			// 元数据（优先级、日期等）会在后续处理循环中重新添加
			taskLine = prefix + gfPrefix + (updates.content || '').trim();
		}
	}

	// 当修改了任务描述时，需要保留原始任务的所有日期字段
	// 将原始任务的日期值填充到 updates 中（如果该字段未被明确更新）
	if (contentModified) {
		const dateFields = ['createdDate', 'startDate', 'scheduledDate', 'dueDate', 'cancelledDate', 'completionDate'];
		for (const field of dateFields) {
			if ((updates as any)[field] === undefined && (task as any)[field] !== undefined) {
				(updates as any)[field] = (task as any)[field];
			}
		}
		// 同样保留原始优先级（如果未被明确更新）
		if (updates.priority === undefined && task.priority !== undefined) {
			// task.priority 是字符串类型，需要转换为对应的枚举值
			const priorityMap: Record<string, 'highest' | 'high' | 'medium' | 'low' | 'lowest' | 'normal'> = {
				'🔺': 'highest',
				'⏫': 'high',
				'🔼': 'medium',
				'🔽': 'low',
				'⏬': 'lowest',
				'none': 'normal',
				'normal': 'normal',
			};
			updates.priority = priorityMap[task.priority] || 'normal';
		}
	}

	// 更新复选框状态（如果提供）
	if (typeof updates.completed === 'boolean') {
		taskLine = taskLine.replace(/\[([ xX])\]/, updates.completed ? '[x]' : '[ ]');
	}

	const formatToUse = determineTaskFormat(task, taskLine, enabledFormats);

	// 更新优先级（如果提供）
	if (updates.priority !== undefined) {
		if (formatToUse === 'dataview') {
			// 移除旧的 priority 字段
			taskLine = taskLine.replace(/\[priority::\s*[^\]]+\]\s*/g, '');
			// 添加新的（normal 表示不写入字段）
			if (updates.priority && updates.priority !== 'normal') {
				taskLine = taskLine.trimEnd() + ` [priority:: ${updates.priority}]`;
			}
		} else {
			// Tasks 格式：移除旧的 emoji，再追加
			taskLine = taskLine.replace(/\s*(🔺|⏫|🔼|🔽|⏬)\s*/g, ' ');
			const emojiMap: Record<string, string> = {
				highest: '🔺',
				high: '⏫',
				medium: '🔼',
				low: '🔽',
				lowest: '⏬',
			};
			if (updates.priority && updates.priority !== 'normal') {
				const emoji = emojiMap[updates.priority];
				if (emoji) {
					taskLine = taskLine.trimEnd() + ` ${emoji}`;
				}
			}
		}
	}

	// 日期字段映射
	const dateFields = ['dueDate', 'startDate', 'scheduledDate', 'createdDate', 'cancelledDate', 'completionDate'];

	// 只处理 updates 中明确提供的日期字段
	for (const key of dateFields) {
		const updateValue = (updates as any)[key];
		// 跳过未在 updates 中提供的字段
		if (updateValue === undefined) {
			continue;
		}

		// 使用辅助函数修改日期字段
		taskLine = modifyDateInLine(taskLine, key, updateValue, formatToUse);
	}

	// 写回
	lines[taskLineIndex] = taskLine;
	const newContent = lines.join('\n');
	await app.vault.modify(file, newContent);
}
