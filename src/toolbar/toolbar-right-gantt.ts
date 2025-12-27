import type { GanttViewRenderer } from '../views/GanttView';
import { renderStatusFilter } from './components/status-filter';
import { renderRefreshButton } from './components/refresh-button';
import { renderTimeGranularity } from './components/time-granularity';
import { renderSortButton } from './components/sort-button';
import { renderTagFilterButton } from './components/tag-filter';
import { renderDualFieldSelector, type DateFieldType } from './components/field-selector';

/**
 * 工具栏右侧区域 - 甘特视图功能区
 */
export class ToolbarRightGantt {
	private dualFieldSelectorInstance?: {
		updateStart: (field: DateFieldType) => void;
		updateEnd: (field: DateFieldType) => void;
		cleanup: () => void;
	};

	render(
		container: HTMLElement,
		ganttRenderer: GanttViewRenderer,
		onRefresh: () => Promise<void>,
		plugin?: any
	): void {
		container.empty();
		container.addClass('toolbar-right-gantt');

		// 时间颗粒度选择按钮
		renderTimeGranularity(
			container,
			{
				current: ganttRenderer.getTimeGranularity(),
				onChange: (granularity) => {
					ganttRenderer.setTimeGranularity(granularity);
					onRefresh(); // 切换颗粒度后刷新视图
				},
			},
			() => {
				ganttRenderer.jumpToToday();
			}
		);

		// 时间字段选择 - 使用新组件（双字段选择器）
		this.dualFieldSelectorInstance = renderDualFieldSelector(container, {
			startField: ganttRenderer.getStartField() as DateFieldType,
			endField: ganttRenderer.getEndField() as DateFieldType,
			onStartFieldChange: (field) => {
				ganttRenderer.setStartField(field);
			},
			onEndFieldChange: (field) => {
				ganttRenderer.setEndField(field);
			}
		});

		// 状态筛选（复用模块）
		renderStatusFilter(container, ganttRenderer.getStatusFilter(), async (v) => {
			ganttRenderer.setStatusFilter(v);
			await onRefresh();
		});

		// 排序按钮
		renderSortButton(container, {
			getCurrentState: () => ganttRenderer.getSortState(),
			onSortChange: async (newState) => {
				ganttRenderer.setSortState(newState);
				await onRefresh();
			}
		});

		// 刷新按钮（共享）
		renderRefreshButton(container, onRefresh, '刷新甘特图');

		// 标签筛选按钮
		if (plugin?.taskCache) {
			renderTagFilterButton(container, {
				getCurrentState: () => ganttRenderer.getTagFilterState(),
				onTagFilterChange: (newState) => {
					ganttRenderer.setTagFilterState(newState);
					onRefresh();
				},
				getAllTasks: () => plugin.taskCache.getAllTasks()
			});
		}
	}

	/**
	 * 清理资源
	 */
	cleanup(): void {
		this.dualFieldSelectorInstance?.cleanup();
	}
}
