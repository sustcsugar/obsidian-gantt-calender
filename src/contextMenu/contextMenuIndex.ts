/**
 * @fileoverview 右键菜单注册
 * @module contextMenu/contextMenuIndex
 */

import { App, Menu } from 'obsidian';
import type { GanttTask } from '../types';
import { createNoteFromTask } from './commands/createNoteFromTask';
import { createNoteFromTaskAlias } from './commands/createNoteFromTaskAlias';
import { openEditTaskModal } from './commands/editTask';

/**
 * 注册任务右键菜单
 * @param taskElement 任务元素
 * @param task 任务对象
 * @param app Obsidian App 实例
 * @param enabledFormats 启用的任务格式
 * @param defaultNotePath 默认笔记路径
 * @param onRefresh 刷新回调
 */
export function registerTaskContextMenu(
	taskElement: HTMLElement,
	task: GanttTask,
	app: App,
	enabledFormats: string[],
	defaultNotePath: string,
	onRefresh: () => void,
	globalFilter?: string
): void {
	taskElement.addEventListener('contextmenu', (e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();

		const menu = new Menu();

		// 编辑任务（统一模态框）
		menu.addItem((item) => {
			item
				.setTitle('编辑任务')
				.setIcon('pencil')
				   .onClick(() => {
					   openEditTaskModal(app, task, enabledFormats, () => {
						   onRefresh();
					   }, true, globalFilter); // 传递true和globalFilter以支持描述编辑
				   });
		});

		// 创建任务笔记:同名
		menu.addItem((item) => {
			item
				.setTitle('创建任务笔记:同名')
				.setIcon('file-plus')
				.onClick(() => {
					createNoteFromTask(app, task, defaultNotePath, globalFilter || '');
				});
		});

		// 创建任务笔记:别名
		menu.addItem((item) => {
			item
				.setTitle('创建任务笔记:别名')
				.setIcon('file-plus')
				.onClick(() => {
					createNoteFromTaskAlias(app, task, defaultNotePath, globalFilter || '');
				});
		});

		menu.showAtMouseEvent(e);
	});
}
