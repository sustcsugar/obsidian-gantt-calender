import { App, Notice, normalizePath, TFolder } from 'obsidian';
import type { GanttTask } from '../../types';
import { formatDate } from '../../dateUtils/dateUtilsIndex';
import { updateTaskProperties } from '../../tasks/taskUpdater';

/**
 * 创建任务同名文件
 * 以任务描述为文件名，创建笔记，存放在默认路径
 */
export async function createNoteFromTask(
	app: App,
	task: GanttTask,
	defaultPath: string,
	enabledFormats: string[] = ['tasks']
): Promise<void> {
	try {
		const raw = task.content;
		// 1) 如果任务中已存在双链，直接打开对应笔记
		const wikiLinkMatch = raw.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
		if (wikiLinkMatch) {
			const linkTarget = wikiLinkMatch[1];
			const dest = app.metadataCache.getFirstLinkpathDest(linkTarget, task.filePath);
			if (dest) {
				const leaf = app.workspace.getLeaf(false);
				await leaf.openFile(dest);
				new Notice('已存在任务笔记');
				return;
			}
		}

		// 2) 收集超链接（Markdown 链接与裸 URL）
		const markdownLinks: Array<{text: string, url: string}> = [];
		const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
		let m: RegExpExecArray | null;
		while ((m = linkRegex.exec(raw)) !== null) {
			markdownLinks.push({ text: m[1], url: m[2] });
		}
		const rawUrls: string[] = [];
		const urlRegex = /(https?:\/\/[^\s)]+)/g;
		let u: RegExpExecArray | null;
		while ((u = urlRegex.exec(raw)) !== null) {
			// 避免与 markdownLinks 重复收集
			if (!markdownLinks.some(l => l.url === u![1])) rawUrls.push(u[1]);
		}

		// 清理任务描述，移除字段与 emoji 与链接
		// task.description 已经移除了元数据标记，只需额外处理 wiki 链接和 markdown 链接
		const baseDesc = removeLinksFromDescription(cleanTaskDescriptionFromTask(task));
		const fileName = sanitizeFileName(baseDesc);

		if (!fileName) {
			new Notice('任务描述为空，无法创建文件');
			return;
		}

		// 确保目标文件夹存在
		await ensureFolderExists(app, defaultPath);

		// 构建文件路径
		const filePath = normalizePath(`${defaultPath}/${fileName}.md`);

		// 检查文件是否已存在
		const existingFile = app.vault.getAbstractFileByPath(filePath);
		if (existingFile) {
			new Notice(`文件已存在: ${fileName}.md`);
			const leaf = app.workspace.getLeaf(false);
			await leaf.openFile(existingFile as any);
			// 仍将任务内容改为双链，方便后续跳转
			await updateTaskProperties(app, task, { content: `[[${fileName}]]` }, enabledFormats);
			return;
		}

		// 创建文件内容（可以包含任务的相关信息）
		const fileContent = generateNoteContent(task, markdownLinks, rawUrls);

		// 创建文件
		const file = await app.vault.create(filePath, fileContent);

		// 打开新创建的文件
		const leaf = app.workspace.getLeaf(false);
		await leaf.openFile(file);

		new Notice(`已创建笔记: ${fileName}.md`);

		// 3) 更新源任务行为双链，使用 updateTaskProperties 保留 tags 等元数据
		await updateTaskProperties(app, task, { content: `[[${fileName}]]` }, enabledFormats);
	} catch (error) {
		console.error('Failed to create note from task:', error);
		new Notice('创建笔记失败');
	}
}

/**
 * 使用已解析的 task.description 清理任务描述（用于文件名生成）
 */
function cleanTaskDescriptionFromTask(task: GanttTask): string {
	let text = task.description || '';
	// 移除 wiki 链接语法，仅保留显示文本
	text = text.replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, ' $1 ');
	// 折叠多余空格
	text = text.replace(/\s{2,}/g, ' ').trim();
	return text;
}

/**
 * 从描述中移除 markdown 链接和裸 URL
 */
function removeLinksFromDescription(text: string): string {
	return text
		.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, ' $1 ') // 去掉 markdown 链接，仅保留文本
		.replace(/(https?:\/\/[^\s)]+)/g, ' ') // 去掉裸 URL
		.replace(/\s{2,}/g, ' ').trim();
}

/**
 * 清理文件名中的非法字符
 */
function sanitizeFileName(name: string): string {
	// 移除或替换文件名中的非法字符
	return name
		.replace(/[\\/:*?"<>|]/g, '-') // 替换非法字符为连字符
		.replace(/\s+/g, ' ') // 折叠多个空格
		.trim()
		.substring(0, 200); // 限制文件名长度
}

/**
 * 确保文件夹存在
 */
async function ensureFolderExists(app: App, folderPath: string): Promise<void> {
	const normalizedPath = normalizePath(folderPath);
	const folder = app.vault.getAbstractFileByPath(normalizedPath);
	
	if (!folder) {
		await app.vault.createFolder(normalizedPath);
	}
}

/**
 * 生成笔记内容
 */
function generateNoteContent(task: GanttTask, mdLinks: Array<{text: string, url: string}>, rawUrls: string[]): string {
	const lines: string[] = [];

	lines.push(`# ${cleanTaskDescriptionFromTask(task)}`);
	lines.push('');
	lines.push('## 任务信息');
	lines.push('');
	
	if (task.priority) {
		lines.push(`- **优先级**: ${task.priority}`);
	}

	if (task.tags && task.tags.length > 0) {
		lines.push(`- **标签**: ${task.tags.map(t => `#${t}`).join(' ')}`);
	}

	if (task.createdDate) {
		lines.push(`- **创建日期**: ${formatDate(task.createdDate, 'yyyy-MM-dd')}`);
	}

	if (task.startDate) {
		lines.push(`- **开始日期**: ${formatDate(task.startDate, 'yyyy-MM-dd')}`);
	}

	if (task.scheduledDate) {
		lines.push(`- **计划日期**: ${formatDate(task.scheduledDate, 'yyyy-MM-dd')}`);
	}

	if (task.dueDate) {
		lines.push(`- **截止日期**: ${formatDate(task.dueDate, 'yyyy-MM-dd')}`);
	}

	if (task.completionDate) {
		lines.push(`- **完成日期**: ${formatDate(task.completionDate, 'yyyy-MM-dd')}`);
	}

	if (task.cancelledDate) {
		lines.push(`- **取消日期**: ${formatDate(task.cancelledDate, 'yyyy-MM-dd')}`);
	}
	
	if (mdLinks.length || rawUrls.length) {
		lines.push('');
		lines.push('## Reference');
		lines.push('');
		for (const l of mdLinks) {
			lines.push(`- [${l.text}](${l.url})`);
		}
		for (const url of rawUrls) {
			lines.push(`- ${url}`);
		}
	}

	lines.push('');
	lines.push(`- **来源**: [[${task.fileName}#^line-${task.lineNumber}|${task.fileName}:${task.lineNumber}]]`);
	lines.push('');
	lines.push('## 笔记内容');
	lines.push('');
	
	return lines.join('\n');
}
