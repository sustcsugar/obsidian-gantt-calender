import { Notice } from 'obsidian';
import { CALENDAR_VIEW_ID } from '../CalendarView';
import { searchTasks } from '../taskManager';
import { TaskListModal } from '../taskModal';
import type GanttCalendarPlugin from '../../main';

/**
 * 注册简单命令（通用功能）
 * @param plugin 插件实例
 */
export function registerCommonCommands(plugin: GanttCalendarPlugin): void {
	// 打开日历视图
	plugin.addCommand({
		id: 'gantt-calendar-open-calendar-view',
		name: '打开日历视图',
		callback: async () => {
			await plugin.activateView();
			const leaf = plugin.app.workspace.getLeavesOfType(CALENDAR_VIEW_ID)[0];
			const view = leaf?.view as any;
			if (view?.switchView) {
				view.switchView('month');
			}
		}
	});

	// 打开任务视图
	plugin.addCommand({
		id: 'gantt-calendar-open-task-view',
		name: '打开任务视图',
		callback: async () => {
			await plugin.activateView();
			const leaf = plugin.app.workspace.getLeavesOfType(CALENDAR_VIEW_ID)[0];
			const view = leaf?.view as any;
			if (view?.switchView) {
				view.switchView('task');
			}
		}
	});

	// 搜索所有任务
	plugin.addCommand({
		id: 'gantt-calendar-search-tasks',
		name: '搜索所有任务',
		callback: async () => {
			try {
				const tasks = await searchTasks(
					plugin.app,
					plugin.settings.globalTaskFilter,
					plugin.settings.enabledTaskFormats
				);
				new TaskListModal(plugin.app, tasks).open();
				new Notice(`找到 ${tasks.length} 个任务`);
			} catch (error) {
				console.error('Error searching tasks:', error);
				new Notice('搜索任务时出错');
			}
		}
	});
}
