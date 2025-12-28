import { BaseCalendarRenderer } from './BaseCalendarRenderer';
import { isToday, isThisWeek, isThisMonth } from '../dateUtils/dateUtilsIndex';
import type { GanttTask, SortState } from '../types';
import { registerTaskContextMenu } from '../contextMenu/contextMenuIndex';
import { sortTasks } from '../tasks/taskSorter';
import { DEFAULT_SORT_STATE } from '../types';
import { ViewClasses, withModifiers } from '../utils/bem';
import { TaskCardComponent, TaskViewConfig } from '../components/TaskCard';
import { VirtualScrollManager } from '../utils/virtualScroll/VirtualScrollManager';

/**
 * 虚拟滚动管理器类型
 */
type VirtualScrollManagerType = VirtualScrollManager<GanttTask>;

/**
 * 任务视图渲染器
 */
export class TaskViewRenderer extends BaseCalendarRenderer {
	// 虚拟滚动管理器
	private virtualScrollManager?: VirtualScrollManagerType;
	private scrollContainer?: HTMLElement;

	// 当前筛选后的任务数据（用于复用）
	private currentTasks: GanttTask[] = [];

	// 任务筛选状态
	private taskFilter: 'all' | 'completed' | 'uncompleted' = 'all';

	// 时间字段筛选
	private timeFieldFilter: 'createdDate' | 'startDate' | 'scheduledDate' | 'dueDate' | 'completionDate' | 'cancelledDate' = 'dueDate';

	// 时间值筛选
	private timeValueFilter: Date | null = null;

	// 日期范围模式：全部/当天/当周/当月/自定义日期
	private dateRangeMode: 'all' | 'day' | 'week' | 'month' | 'custom' = 'week';

	// 排序状态
	private sortState: SortState = DEFAULT_SORT_STATE;

	// 预估任务卡片高度（像素）
	private readonly estimatedItemHeight = 60;

	// ===== Getter/Setter 方法 =====

	public getTaskFilter(): 'all' | 'completed' | 'uncompleted' {
		return this.taskFilter;
	}

	public setTaskFilter(value: 'all' | 'completed' | 'uncompleted'): void {
		this.taskFilter = value;
	}

	public getTimeFilterField(): 'createdDate' | 'startDate' | 'scheduledDate' | 'dueDate' | 'completionDate' | 'cancelledDate' {
		return this.timeFieldFilter;
	}

	public setTimeFilterField(value: any): void {
		this.timeFieldFilter = value;
	}

	public getSpecificDate(): Date | null {
		return this.timeValueFilter;
	}

	public setSpecificDate(date: Date | null): void {
		this.timeValueFilter = date;
	}

	public getDateRangeMode(): 'all' | 'day' | 'week' | 'month' | 'custom' {
		return this.dateRangeMode;
	}

	public setDateRangeMode(mode: 'all' | 'day' | 'week' | 'month' | 'custom'): void {
		this.dateRangeMode = mode;
	}

	public getSortState(): SortState {
		return this.sortState;
	}

	public setSortState(state: SortState): void {
		this.sortState = state;
	}

	/**
	 * 创建状态筛选组（在工具栏右侧功能区调用）
	 */
	public createStatusFilterGroup(container: HTMLElement, onFilterChange: () => void): void {
		const statusFilterGroup = container.createDiv('toolbar-right-task-status-group');
		const statusLabel = statusFilterGroup.createEl('span', { text: '状态', cls: 'toolbar-right-task-status-label' });

		const statusSelect = statusFilterGroup.createEl('select', { cls: 'toolbar-right-task-status-select' });
		statusSelect.innerHTML = `
			<option value="all">全部</option>
			<option value="uncompleted">未完成</option>
			<option value="completed">已完成</option>
		`;
		statusSelect.value = this.taskFilter;
		statusSelect.addEventListener('change', (e) => {
			const value = (e.target as HTMLSelectElement).value as 'all' | 'completed' | 'uncompleted';
			this.setTaskFilter(value);
			onFilterChange();
		});
	}

	render(container: HTMLElement, currentDate: Date): void {
		// 创建任务视图容器
		const taskRoot = container.createDiv(withModifiers(ViewClasses.block, ViewClasses.modifiers.task));

		// 创建滚动容器（用于虚拟滚动）
		this.scrollContainer = taskRoot.createDiv('gc-task-scroll-container');
		this.loadTaskList(this.scrollContainer);
	}

	/**
	 * 加载任务列表
	 */
	private async loadTaskList(listContainer: HTMLElement): Promise<void> {
		listContainer.empty();

		try {
			let tasks: GanttTask[] = this.plugin.taskCache.getAllTasks();

			// 应用完成状态筛选
			if (this.taskFilter === 'completed') {
				tasks = tasks.filter(t => t.completed);
			} else if (this.taskFilter === 'uncompleted') {
				tasks = tasks.filter(t => !t.completed);
			}

			// 日期范围筛选
			const mode = this.getDateRangeMode();
			if (mode !== 'all') {
				const ref = this.timeValueFilter ?? new Date();
				const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
				const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };
				const startOfWeek = (d: Date) => { const x = startOfDay(d); const day = x.getDay(); const diff = (day + 6) % 7; x.setDate(x.getDate() - diff); return x; };
				const endOfWeek = (d: Date) => { const s = startOfWeek(d); const e = new Date(s); e.setDate(s.getDate() + 6); e.setHours(23,59,59,999); return e; };
				const startOfMonth = (d: Date) => { const x = startOfDay(d); x.setDate(1); return x; };
				const endOfMonth = (d: Date) => { const x = startOfDay(d); x.setMonth(x.getMonth()+1, 0); x.setHours(23,59,59,999); return x; };

				let rangeStart: Date;
				let rangeEnd: Date;
				if (mode === 'day' || mode === 'custom') {
					rangeStart = startOfDay(ref);
					rangeEnd = endOfDay(ref);
				} else if (mode === 'week') {
					rangeStart = startOfWeek(ref);
					rangeEnd = endOfWeek(ref);
				} else { // month
					rangeStart = startOfMonth(ref);
					rangeEnd = endOfMonth(ref);
				}

				tasks = tasks.filter(task => {
					const dateValue = (task as any)[this.timeFieldFilter];
					if (!dateValue) return false;
					const taskDate = new Date(dateValue);
					if (isNaN(taskDate.getTime())) return false;
					return taskDate >= rangeStart && taskDate <= rangeEnd;
				});
			}

			// 应用标签筛选
			tasks = this.applyTagFilter(tasks);

			// 应用排序
			tasks = sortTasks(tasks, this.sortState);

			// 保存当前筛选后的任务
			this.currentTasks = tasks;

			if (tasks.length === 0) {
				listContainer.createEl('div', { text: '未找到符合条件的任务', cls: 'gantt-task-empty' });
				// 清理旧的虚拟滚动管理器
				if (this.virtualScrollManager) {
					this.virtualScrollManager.destroy();
					this.virtualScrollManager = undefined;
				}
				return;
			}

			// 构建日期范围描述
			const dateRangeDesc = this.buildDateRangeDescription();

			// 输出调试信息
			console.log('[TaskView] 开始渲染任务列表', {
				任务数量: tasks.length,
				状态筛选: this.taskFilter,
				字段筛选: this.getFieldLabel(this.timeFieldFilter),
				日期范围: this.getDateRangeModeLabel(),
				日期描述: dateRangeDesc
			});

			// 创建或更新虚拟滚动管理器
			this.setupVirtualScroll(listContainer, tasks, dateRangeDesc);

		} catch (error) {
			console.error('[TaskView] Error rendering task view', error);
			listContainer.empty();
			listContainer.createEl('div', { text: '加载任务时出错', cls: 'gantt-task-empty' });
		}
	}

	/**
	 * 设置虚拟滚动管理器（复用或创建新实例）
	 */
	private setupVirtualScroll(
		container: HTMLElement,
		tasks: GanttTask[],
		dateRangeDesc: string
	): void {
		// 如果已存在虚拟滚动管理器，直接更新数据
		if (this.virtualScrollManager) {
			// 检查滚动容器是否仍然在 DOM 中
			if (container.contains(this.virtualScrollManager.getScrollContainer())) {
				// 复用现有实例，只更新数据
				this.virtualScrollManager.updateItems(tasks);
				return;
			} else {
				// 容器已不在 DOM 中，销毁旧实例
				this.virtualScrollManager.destroy();
				this.virtualScrollManager = undefined;
			}
		}

		// 创建新的虚拟滚动管理器
		this.virtualScrollManager = new VirtualScrollManager<GanttTask>({
			items: tasks,
			estimatedItemHeight: this.estimatedItemHeight,
			bufferSize: 200, // 缓冲区 200px
			container: container,
			debug: {
				enabled: true,
				prefix: '[TaskView]',
				viewType: '任务视图',
				dateRangeMode: this.getDateRangeModeLabel(),
				dateRangeDesc: dateRangeDesc
			},
			// 渲染单个任务
			renderItem: (task, index) => {
				return this.renderTaskItem(task, index);
			}
		});

		// 启用滚动监听
		this.virtualScrollManager.enableScrollListener();
	}

	/**
	 * 渲染任务项（返回 DOM 元素，不直接添加到容器）
	 */
	private renderTaskItem(task: GanttTask, index: number): HTMLElement {
		// 创建包装元素
		const wrapper = document.createElement('div');
		wrapper.className = 'gc-task-card gc-task-card--task gc-task-card--pending task-with-status';
		wrapper.dataset.index = String(index);
		wrapper.style.width = '100%';

		// 创建任务卡片组件，渲染到包装元素中
		new TaskCardComponent({
			task,
			config: TaskViewConfig,
			container: wrapper,
			app: this.app,
			plugin: this.plugin,
			onClick: (clickedTask) => {
				// 刷新任务列表
				if (this.scrollContainer) {
					this.loadTaskList(this.scrollContainer);
				}
			},
		}).render();

		// 注册右键菜单
		const taskCard = wrapper.firstElementChild as HTMLElement;
		if (taskCard) {
			const enabledFormats = this.plugin.settings.enabledTaskFormats;
			const defaultNotePath = this.plugin.settings.defaultNotePath || '';
			registerTaskContextMenu(
				taskCard,
				task,
				this.app,
				enabledFormats,
				defaultNotePath,
				() => {
					if (this.scrollContainer) {
						this.loadTaskList(this.scrollContainer);
					}
				}
			);
		}

		return wrapper;
	}

	/**
	 * 获取日期范围模式的中文标签
	 */
	private getDateRangeModeLabel(): string {
		const labels: Record<string, string> = {
			'all': '全部',
			'day': '当天',
			'week': '当周',
			'month': '当月',
			'custom': '自定义'
		};
		return labels[this.dateRangeMode] || this.dateRangeMode;
	}

	/**
	 * 获取时间字段的中文标签
	 */
	private getFieldLabel(field: string): string {
		const labels: Record<string, string> = {
			'createdDate': '创建时间',
			'startDate': '开始时间',
			'scheduledDate': '计划时间',
			'dueDate': '截止时间',
			'completionDate': '完成时间',
			'cancelledDate': '取消时间'
		};
		return labels[field] || field;
	}

	/**
	 * 构建日期范围描述
	 */
	private buildDateRangeDescription(): string {
		if (this.dateRangeMode === 'all') {
			return '全部时间';
		}

		const ref = this.timeValueFilter ?? new Date();
		const formatDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

		if (this.dateRangeMode === 'day' || this.dateRangeMode === 'custom') {
			return formatDate(ref);
		} else if (this.dateRangeMode === 'week') {
			// 计算周的开始和结束
			const startOfWeek = new Date(ref);
			const day = startOfWeek.getDay();
			const diff = (day + 6) % 7;
			startOfWeek.setDate(startOfWeek.getDate() - diff);
			const endOfWeek = new Date(startOfWeek);
			endOfWeek.setDate(endOfWeek.getDate() + 6);
			return `${formatDate(startOfWeek)} ~ ${formatDate(endOfWeek)}`;
		} else if (this.dateRangeMode === 'month') {
			return `${ref.getFullYear()}年${ref.getMonth() + 1}月`;
		}

		return this.dateRangeMode;
	}

	/**
	 * 清理资源（在视图卸载时调用）
	 */
	runDomCleanups(): void {
		if (this.virtualScrollManager) {
			this.virtualScrollManager.destroy();
			this.virtualScrollManager = undefined;
		}
	}
}
