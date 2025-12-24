import { App } from 'obsidian';
import type { GanttTask } from '../../types';
import { updateTaskDateField } from '../../tasks/taskUpdater';

/**
 * 取消任务（设置取消日期为今天）
 */
export async function cancelTask(
	app: App,
	task: GanttTask,
	enabledFormats: string[],
	onSuccess: () => void
): Promise<void> {
	try {
		const today = new Date();
		await updateTaskDateField(app, task, 'cancelledDate', today, enabledFormats);
		onSuccess();
	} catch (error) {
		console.error('Failed to cancel task:', error);
	}
}
