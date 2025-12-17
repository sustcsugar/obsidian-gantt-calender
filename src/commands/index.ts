import type GanttCalendarPlugin from '../../main';
import { registerCommonCommands } from './common';
import { registerEditorCommands } from './editor';
import { registerConditionalCommands } from './conditional';

/**
 * 注册所有命令
 * @param plugin 插件实例
 */
export function registerAllCommands(plugin: GanttCalendarPlugin): void {
	registerCommonCommands(plugin);
	registerEditorCommands(plugin);
	registerConditionalCommands(plugin);
}
