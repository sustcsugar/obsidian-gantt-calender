import { App } from 'obsidian';
import { GanttTask } from '../types';
import { parseTasksFromListItems } from './parser';

/**
 * 从笔记库中搜索所有符合全局筛选条件的任务
 */
export async function searchTasks(app: App, globalTaskFilter: string, enabledFormats?: string[]): Promise<GanttTask[]> {
	const tasks: GanttTask[] = [];
	const markdownFiles = app.vault.getMarkdownFiles();
	const formats = enabledFormats || ['tasks', 'dataview'];

	for (const file of markdownFiles) {
		const fileCache = app.metadataCache.getFileCache(file);
		const listItems = fileCache?.listItems;
		if (!listItems || listItems.length === 0) {
			continue;
		}
		const content = await app.vault.read(file);
		const lines = content.split('\n');
		const parsed = parseTasksFromListItems(file, lines, listItems, formats, globalTaskFilter);
		tasks.push(...parsed);
	}

	return tasks.sort((a, b) => {
		if (a.fileName !== b.fileName) {
			return a.fileName.localeCompare(b.fileName);
		}
		return a.lineNumber - b.lineNumber;
	});
}
