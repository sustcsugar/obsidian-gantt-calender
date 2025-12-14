import { App, TFile } from 'obsidian';

export interface GanttTask {
	filePath: string;
	fileName: string;
	lineNumber: number;
	content: string;
	completed: boolean;
}

/**
 * 从笔记库中搜索所有符合全局筛选条件的任务
 */
export async function searchTasks(app: App, globalTaskFilter: string): Promise<GanttTask[]> {
	const tasks: GanttTask[] = [];
	const markdownFiles = app.vault.getMarkdownFiles();

	for (const file of markdownFiles) {
		const content = await app.vault.read(file);
		const lines = content.split('\n');

		lines.forEach((line, index) => {
			// 检查是否是任务行（以 [ ] 或 [x] 开头）
			const taskMatch = line.match(/^\s*[-*]\s*\[([ xX])\]\s*(.*)/);
			if (!taskMatch) return;

			const [, checkedStatus, taskContent] = taskMatch;
			const isCompleted = checkedStatus.toLowerCase() === 'x';

			// 检查任务内容是否包含全局筛选标记
			if (globalTaskFilter && !taskContent.includes(globalTaskFilter)) {
				return;
			}

			// 清理任务内容，移除筛选标记
			const cleanedContent = globalTaskFilter 
				? taskContent.replace(new RegExp(`^\\s*${escapeRegExp(globalTaskFilter)}\\s*`), '')
				: taskContent;

			tasks.push({
				filePath: file.path,
				fileName: file.basename,
				lineNumber: index + 1,
				content: cleanedContent,
				completed: isCompleted,
			});
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
 * 转义正则表达式中的特殊字符
 */
function escapeRegExp(string: string): string {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
