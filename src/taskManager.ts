import { App, TFile } from 'obsidian';

export interface GanttTask {
	filePath: string;
	fileName: string;
	lineNumber: number;
	content: string;
	completed: boolean;
	priority?: string; // highest, high, medium, low, lowest
	createdDate?: Date;
	startDate?: Date;
	scheduledDate?: Date;
	dueDate?: Date;
	cancelledDate?: Date;
	completionDate?: Date;
}

/**
 * 从笔记库中搜索所有符合全局筛选条件的任务
 */
export async function searchTasks(app: App, globalTaskFilter: string, enabledFormats?: string[]): Promise<GanttTask[]> {
	const tasks: GanttTask[] = [];
	const markdownFiles = app.vault.getMarkdownFiles();
	const formats = enabledFormats || ['tasks', 'dataview'];

	for (const file of markdownFiles) {
		const content = await app.vault.read(file);
		const lines = content.split('\n');

		lines.forEach((line, index) => {
			// 检查是否是任务行（以 [ ] 或 [x] 开头）
			const taskMatch = line.match(/^\s*[-*]\s*\[([ xX])\]\s*(.*)/);
			if (!taskMatch) return;

			const [, checkedStatus, taskContent] = taskMatch;
			const isCompleted = checkedStatus.toLowerCase() === 'x';

			// 检查任务头部是否包含全局筛选标记（仅检查头部）
			if (globalTaskFilter) {
				const trimmedContent = taskContent.trim();
				if (!trimmedContent.startsWith(globalTaskFilter)) {
					return;
				}
			}

			// 移除头部筛选标记
			const contentWithoutFilter = globalTaskFilter
				? taskContent.replace(new RegExp(`^\\s*${escapeRegExp(globalTaskFilter)}\\s*`), '')
				: taskContent;

			// 提取日期和其他属性
			const task: GanttTask = {
				filePath: file.path,
				fileName: file.basename,
				lineNumber: index + 1,
				content: contentWithoutFilter,
				completed: isCompleted,
			};

			// 根据启用的格式解析日期
			if (formats.includes('tasks')) {
				parseTasksFormat(contentWithoutFilter, task);
			}
			if (formats.includes('dataview')) {
				parseDataviewFormat(contentWithoutFilter, task);
			}

			tasks.push(task);
		});
	}

	return tasks.sort((a, b) => {
		// 按文件名排序，然后按行号排序
		if (a.fileName !== b.fileName) {
			return a.fileName.localeCompare(b.fileName);
		}
		return a.lineNumber - b.lineNumber;
	});
}

/**
 * 解析 Tasks 插件格式日期和优先级（使用emoji表示）
 * 优先级: 🔺 highest, ⏫ high, 🔼 medium, 🔽 low, ⏬ lowest
 * 日期: ➕ 创建日期, 🛫 开始日期, ⏳ 计划日期, 📅 due日期, ❌ 取消日期, ✅ 完成日期
 */
function parseTasksFormat(content: string, task: GanttTask): void {
	// 解析优先级（使用emoji）
	if (content.includes('🔺')) {
		task.priority = 'highest';
	} else if (content.includes('⏫')) {
		task.priority = 'high';
	} else if (content.includes('🔼')) {
		task.priority = 'medium';
	} else if (content.includes('🔽')) {
		task.priority = 'low';
	} else if (content.includes('⏬')) {
		task.priority = 'lowest';
	}
	// 如果没有优先级emoji，则为 normal（不设置priority字段）

	// 解析日期
	const dateRegex = /(➕|🛫|⏳|📅|❌|✅)\s*(\d{4}-\d{2}-\d{2})/g;
	let match;

	while ((match = dateRegex.exec(content)) !== null) {
		const [, emoji, dateStr] = match;
		const date = new Date(dateStr);

		switch (emoji) {
			case '➕':
				task.createdDate = date;
				break;
			case '🛫':
				task.startDate = date;
				break;
			case '⏳':
				task.scheduledDate = date;
				break;
			case '📅':
				task.dueDate = date;
				break;
			case '❌':
				task.cancelledDate = date;
				break;
			case '✅':
				task.completionDate = date;
				break;
		}
	}
}

/**
 * 解析 Dataview 插件格式日期和优先级（使用字段表示）
 * [priority:: ...], [created:: ...], [start:: ...], [scheduled:: ...], [due:: ...], [cancelled:: ...], [completion:: ...]
 */
function parseDataviewFormat(content: string, task: GanttTask): void {
	const fieldRegex = /\[(priority|created|start|scheduled|due|cancelled|completion)::\s*([^\]]+)\]/g;
	let match;

	while ((match = fieldRegex.exec(content)) !== null) {
		const [, field, value] = match;
		const trimmedValue = value.trim();

		switch (field) {
			case 'priority':
				// 解析优先级
				const priorityValue = trimmedValue.toLowerCase();
				if (['highest', 'high', 'medium', 'low', 'lowest'].includes(priorityValue)) {
					task.priority = priorityValue;
				}
				break;
			case 'created':
			case 'start':
			case 'scheduled':
			case 'due':
			case 'cancelled':
			case 'completion':
				// 尝试解析日期
				const date = new Date(trimmedValue);
				if (isNaN(date.getTime())) continue;

				if (field === 'created') task.createdDate = date;
				else if (field === 'start') task.startDate = date;
				else if (field === 'scheduled') task.scheduledDate = date;
				else if (field === 'due') task.dueDate = date;
				else if (field === 'cancelled') task.cancelledDate = date;
				else if (field === 'completion') task.completionDate = date;
				break;
		}
	}
}

/**
 * 转义正则表达式中的特殊字符
 */
function escapeRegExp(string: string): string {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
