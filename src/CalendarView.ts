import { ItemView, WorkspaceLeaf, setIcon, Notice } from 'obsidian';
import { CalendarViewType } from './types';
import { getWeekOfDate, formatDate, formatMonth } from './utils';
import { solarToLunar, getShortLunarText } from './lunar';
import { YearViewRenderer } from './views/YearView';
import { MonthViewRenderer } from './views/MonthView';
import { WeekViewRenderer } from './views/WeekView';
import { DayViewRenderer } from './views/DayView';
import { TaskViewRenderer } from './views/TaskView';

export const CALENDAR_VIEW_ID = 'gantt-calendar-view';

export class CalendarView extends ItemView {
	private currentDate: Date = new Date();
	private viewType: CalendarViewType = 'year';
	private lastCalendarViewType: CalendarViewType = 'month';
	private resizeObserver: ResizeObserver | null = null;
	private plugin: any;
	private cacheUpdateListener: (() => void) | null = null;

	// 子视图渲染器
	private yearRenderer: YearViewRenderer;
	private monthRenderer: MonthViewRenderer;
	private weekRenderer: WeekViewRenderer;
	private dayRenderer: DayViewRenderer;
	private taskRenderer: TaskViewRenderer;

	constructor(leaf: WorkspaceLeaf, plugin: any) {
		super(leaf);
		this.plugin = plugin;
		// 存储 calendarView 引用到 plugin,供子渲染器访问
		this.plugin.calendarView = this;

		// 初始化子视图渲染器
		this.yearRenderer = new YearViewRenderer(this.app, plugin);
		this.monthRenderer = new MonthViewRenderer(this.app, plugin);
		this.weekRenderer = new WeekViewRenderer(this.app, plugin);
		this.dayRenderer = new DayViewRenderer(this.app, plugin);
		this.taskRenderer = new TaskViewRenderer(this.app, plugin);
	}

	getViewType(): string {
		return CALENDAR_VIEW_ID;
	}

	getDisplayText(): string {
		return 'Gantt Calendar';
	}

	getIcon(): string {
		return 'calendar-days';
	}

	async onOpen(): Promise<void> {
		// 等待任务缓存准备完成
		if (this.plugin?.taskCache?.whenReady) {
			await this.plugin.taskCache.whenReady();
		}
		this.render();
		this.setupResizeObserver();

		// 订阅缓存更新事件
		this.cacheUpdateListener = () => {
			if (this.containerEl.isConnected) {
				this.render();
			}
		};
		this.plugin?.taskCache?.onUpdate(this.cacheUpdateListener);
	}

	public refreshSettings(): void {
		// 重新渲染内容
		this.render();
	}

	async onClose(): Promise<void> {
		// Unsubscribe from cache updates
		if (this.cacheUpdateListener) {
			this.plugin?.taskCache?.offUpdate(this.cacheUpdateListener);
			this.cacheUpdateListener = null;
		}

		// Cleanup renderers
		this.yearRenderer.runDomCleanups();
		this.monthRenderer.runDomCleanups();
		this.weekRenderer.runDomCleanups();
		this.dayRenderer.runDomCleanups();
		this.taskRenderer.runDomCleanups();

		// Cleanup resize observer
		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
		}
	}

	private setupResizeObserver(): void {
		// 监听容器大小变化，重新计算年视图农历显示
		const content = this.containerEl.children[1];
		if (!content) return;

		try {
			this.resizeObserver = new ResizeObserver(() => {
				if (this.viewType === 'year') {
					this.yearRenderer.updateAllMonthCards();
				}
			});

			this.resizeObserver.observe(content);
		} catch (e) {
			// ResizeObserver not supported, fail silently
		}
	}

	private render(): void {
		// 清理上一次渲染的资源
		this.yearRenderer.runDomCleanups();
		this.monthRenderer.runDomCleanups();
		this.weekRenderer.runDomCleanups();
		this.dayRenderer.runDomCleanups();
		this.taskRenderer.runDomCleanups();

		const container = this.containerEl.children[1];
		container.empty();

		// Create toolbar
		const toolbar = container.createDiv('calendar-toolbar');
		this.createToolbar(toolbar);

		// Create calendar content
		const content = container.createDiv('calendar-content');
		this.renderCalendarContent(content);

		// 年视图应用农历字号
		if (this.viewType === 'year') {
			this.yearRenderer.applyLunarFontSize(content);
		}
	}

	private createToolbar(toolbar: HTMLElement): void {
		const isTaskView = this.viewType === 'task';

		// Left region: 视图选择（Tasks / Calendar）
		const left = toolbar.createDiv('calendar-toolbar-left');
		const toggleGroup = left.createDiv('calendar-toggle-group');
		const taskToggle = toggleGroup.createEl('button', { text: 'Tasks' });
		taskToggle.addClass('calendar-toggle-btn');
		if (isTaskView) taskToggle.addClass('active');
		taskToggle.onclick = () => this.switchView('task');

		const calendarToggle = toggleGroup.createEl('button', { text: 'Calendar' });
		calendarToggle.addClass('calendar-toggle-btn');
		if (!isTaskView) calendarToggle.addClass('active');
		calendarToggle.onclick = () => {
			const target = this.lastCalendarViewType || 'month';
			this.switchView(target);
		};

		// Center region: 显示区（日期范围或标题，日视图附加农历/节日）
		const center = toolbar.createDiv('calendar-toolbar-center');
		const dateDisplay = center.createEl('span');
		dateDisplay.addClass('calendar-date-display');
		if (this.viewType === 'day') {
			const lunar = solarToLunar(this.currentDate);
			const lunarText = getShortLunarText(this.currentDate);
			let displayText = this.getDateRangeText();
			if (lunarText) displayText += ` • ${lunarText}`;
			if (lunar.festival) displayText += ` • ${lunar.festival}`;
			dateDisplay.setText(displayText);
		} else {
			dateDisplay.setText(this.getDateRangeText());
		}

		// Right region: 功能区（随视图变化）
		const right = toolbar.createDiv('calendar-toolbar-right');
		if (isTaskView) {
			this.createTaskViewToolbar(right);
		} else {
			this.createCalendarViewToolbar(right);
		}
	}

	/**
	 * 创建任务视图工具栏
	 */
	private createTaskViewToolbar(right: HTMLElement): void {
		// Global Filter 状态
		const gfText = right.createEl('span', { cls: 'gantt-filter-label' });
		gfText.setText(`Global Filter: ${this.plugin?.settings?.globalTaskFilter || '（未设置）'}`);

		// ===== 状态筛选 - 由 TaskViewRenderer 创建 =====
		this.taskRenderer.createStatusFilterGroup(right, () => this.render());

		// ===== 分割线 =====
		const divider = right.createDiv('gantt-filter-divider');

		// ===== 时间筛选 - 下拉选择 + 时间输入 + 日期选择器 =====
		const timeFilterGroup = right.createDiv('gantt-time-filter-group');
		const timeLabel = timeFilterGroup.createEl('span', { text: '时间筛选', cls: 'gantt-filter-group-label' });
		
		// 时间字段选择
		const fieldSelect = timeFilterGroup.createEl('select', { cls: 'gantt-filter-select gantt-time-field-select' });
		fieldSelect.innerHTML = `
			<option value="createdDate">创建时间</option>
			<option value="startDate">开始时间</option>
			<option value="scheduledDate">规划时间</option>
			<option value="dueDate">截止时间</option>
			<option value="completionDate">完成时间</option>
			<option value="cancelledDate">取消时间</option>
		`;
		fieldSelect.value = this.taskRenderer.getTimeFilterField();
		fieldSelect.addEventListener('change', (e) => {
			const value = (e.target as HTMLSelectElement).value as 'createdDate' | 'startDate' | 'scheduledDate' | 'dueDate' | 'completionDate' | 'cancelledDate';
			this.taskRenderer.setTimeFilterField(value);
			this.render();
		});

		// 刷新按钮
		const refreshBtn = right.createEl('button', { cls: 'calendar-view-btn icon-btn', attr: { title: '刷新任务' } });
		setIcon(refreshBtn, 'rotate-ccw');
		refreshBtn.addEventListener('click', async () => {
			await this.plugin.taskCache.initialize(
				this.plugin.settings.globalTaskFilter,
				this.plugin.settings.enabledTaskFormats
			);
			this.render();
		});
	}

	/**
	 * 创建日历视图工具栏
	 */
	private createCalendarViewToolbar(right: HTMLElement): void {
		// 日历视图功能区：上一期/今天/下一期 + 子视图选择
		const navButtons = right.createDiv('calendar-nav-buttons');
		const prevBtn = navButtons.createEl('button', { text: '◀ 上一个' });
		prevBtn.addClass('calendar-nav-btn');
		prevBtn.onclick = () => this.previousPeriod();

		const nextBtn = navButtons.createEl('button', { text: '下一个 ▶' });
		nextBtn.addClass('calendar-nav-btn');
		nextBtn.onclick = () => this.nextPeriod();

		const todayBtn = navButtons.createEl('button', { text: '今天' });
		todayBtn.addClass('calendar-nav-btn');
		todayBtn.onclick = () => this.goToToday();

		const viewContainer = right.createDiv('calendar-view-selector');
		const viewTypes: { [key: string]: string } = {
			'day': '日',
			'week': '周',
			'month': '月',
			'year': '年',
		};

		['day', 'week', 'month', 'year'].forEach((type) => {
			const btn = viewContainer.createEl('button', { text: viewTypes[type] });
			btn.addClass('calendar-view-btn');
			if (type === this.viewType) btn.addClass('active');
			btn.onclick = () => this.switchView(type as CalendarViewType);
		});

		// 刷新按钮（图标模式 + 悬浮提示）
		const refreshBtn = right.createEl('button', { cls: 'calendar-view-btn icon-btn', attr: { title: '刷新任务' } });
		setIcon(refreshBtn, 'rotate-ccw');
		refreshBtn.addEventListener('click', async () => {
			// 重新扫描库并更新缓存
			await this.plugin.taskCache.initialize(
				this.plugin.settings.globalTaskFilter,
				this.plugin.settings.enabledTaskFormats
			);
			this.render();
		});
	}

	/**
	 * 显示日期选择器弹窗
	 */
	private showDatePickerPopover(triggerElement: HTMLElement): void {
		// 创建弹出菜单容器
		const popover = document.body.createDiv('gantt-date-picker-popover');
		
		// 获取当前选中日期（如果有）
		let selectedDate = this.taskRenderer.getSpecificDate();
		if (!selectedDate) {
			selectedDate = new Date();
		}

		// 显示当前年月
		let currentYear = selectedDate.getFullYear();
		let currentMonth = selectedDate.getMonth();

		const renderCalendar = () => {
			popover.empty();
			
			// 头部：年月导航
			const header = popover.createDiv('date-picker-header');
			
			const prevMonthBtn = header.createEl('button', { text: '◀' });
			prevMonthBtn.addEventListener('click', () => {
				currentMonth--;
				if (currentMonth < 0) {
					currentMonth = 11;
					currentYear--;
				}
				renderCalendar();
			});

			const monthDisplay = header.createEl('span', { cls: 'date-picker-month-display' });
			monthDisplay.setText(`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`);

			const nextMonthBtn = header.createEl('button', { text: '▶' });
			nextMonthBtn.addEventListener('click', () => {
				currentMonth++;
				if (currentMonth > 11) {
					currentMonth = 0;
					currentYear++;
				}
				renderCalendar();
			});

			// 日期网格
			const daysGrid = popover.createDiv('date-picker-days');
			
			// 周日至周六标签
			const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
			weekDays.forEach(day => {
				const dayLabel = daysGrid.createEl('div', { text: day, cls: 'date-picker-weekday' });
			});

			// 获取该月的日期
			const firstDay = new Date(currentYear, currentMonth, 1);
			const lastDay = new Date(currentYear, currentMonth + 1, 0);
			const daysInMonth = lastDay.getDate();
			const startingDayOfWeek = firstDay.getDay();

			// 填充前一月的日期
			const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();
			for (let i = startingDayOfWeek - 1; i >= 0; i--) {
				const day = daysInPrevMonth - i;
				const dayEl = daysGrid.createEl('div', { text: String(day), cls: 'date-picker-day date-picker-other-month' });
			}

			// 填充本月的日期
			for (let day = 1; day <= daysInMonth; day++) {
				const dayEl = daysGrid.createEl('div', { text: String(day), cls: 'date-picker-day' });
				
				const dateObj = new Date(currentYear, currentMonth, day);
				
				// 标记今天
				if (this.isToday(dateObj)) {
					dayEl.addClass('date-picker-today');
				}

				// 标记已选择的日期
				if (selectedDate && 
					dateObj.getFullYear() === selectedDate.getFullYear() &&
					dateObj.getMonth() === selectedDate.getMonth() &&
					dateObj.getDate() === selectedDate.getDate()) {
					dayEl.addClass('date-picker-selected');
				}

				dayEl.addEventListener('click', () => {
					this.taskRenderer.setSpecificDate(dateObj);
					selectedDate = dateObj;
					popover.remove();
					this.render();
				});
			}

			// 填充下一月的日期
			const remainingDays = 42 - (startingDayOfWeek + daysInMonth);
			for (let day = 1; day <= remainingDays; day++) {
				const dayEl = daysGrid.createEl('div', { text: String(day), cls: 'date-picker-day date-picker-other-month' });
			}
		};

		renderCalendar();

		// 定位弹出菜单
		const rect = triggerElement.getBoundingClientRect();
		popover.style.position = 'fixed';
		popover.style.left = rect.left + 'px';
		popover.style.top = (rect.bottom + 5) + 'px';
		popover.style.zIndex = '1000';

		// 点击外部关闭
		const closePopover = () => {
			if (popover && popover.parentElement) {
				popover.remove();
			}
			document.removeEventListener('click', handleOutsideClick);
		};

		const handleOutsideClick = (e: MouseEvent) => {
			if (!popover.contains(e.target as Node) && triggerElement !== e.target) {
				closePopover();
			}
		};

		setTimeout(() => {
			document.addEventListener('click', handleOutsideClick);
		}, 0);
	}

	/**
	 * 检查是否是今天
	 */
	private isToday(date: Date): boolean {
		const today = new Date();
		return (
			date.getDate() === today.getDate() &&
			date.getMonth() === today.getMonth() &&
			date.getFullYear() === today.getFullYear()
		);
	}

	private renderCalendarContent(content: HTMLElement): void {
		switch (this.viewType) {
			case 'year':
				this.yearRenderer.render(content, this.currentDate);
				break;
			case 'month':
				this.monthRenderer.render(content, this.currentDate);
				break;
			case 'week':
				this.weekRenderer.render(content, this.currentDate);
				break;
			case 'day':
				this.dayRenderer.render(content, this.currentDate);
				break;
			case 'task':
				this.taskRenderer.render(content, this.currentDate);
				break;
		}
	}

	// ===== 公共方法供子渲染器调用 =====

	public selectDate(date: Date): void {
		this.currentDate = new Date(date);
		if (this.viewType !== 'day') {
			this.viewType = 'day';
		}
		this.render();
	}

	public switchView(type: CalendarViewType): void {
		if (type !== 'task') {
			this.lastCalendarViewType = type;
		}
		this.viewType = type;
		this.render();
	}

	// ===== 导航方法 =====

	private previousPeriod(): void {
		const date = new Date(this.currentDate);
		switch (this.viewType) {
			case 'year':
				date.setFullYear(date.getFullYear() - 1);
				break;
			case 'month':
				date.setMonth(date.getMonth() - 1);
				break;
			case 'week':
				date.setDate(date.getDate() - 7);
				break;
			case 'day':
				date.setDate(date.getDate() - 1);
				break;
			case 'task':
				return;
		}
		this.currentDate = date;
		this.render();
	}

	private nextPeriod(): void {
		const date = new Date(this.currentDate);
		switch (this.viewType) {
			case 'year':
				date.setFullYear(date.getFullYear() + 1);
				break;
			case 'month':
				date.setMonth(date.getMonth() + 1);
				break;
			case 'week':
				date.setDate(date.getDate() + 7);
				break;
			case 'day':
				date.setDate(date.getDate() + 1);
				break;
			case 'task':
				return;
		}
		this.currentDate = date;
		this.render();
	}

	private goToToday(): void {
		if (this.viewType === 'task') return;
		this.currentDate = new Date();
		this.render();
	}

	private getDateRangeText(): string {
		switch (this.viewType) {
			case 'year':
				return this.currentDate.getFullYear().toString();
			case 'month':
				return formatMonth(
					this.currentDate.getFullYear(),
					this.currentDate.getMonth() + 1
				);
			case 'week': {
				const week = getWeekOfDate(this.currentDate, undefined, !!(this.plugin?.settings?.startOnMonday));
				const start = formatDate(week.startDate);
				const end = formatDate(week.endDate);
				return `Week ${week.weekNumber} (${start} - ${end})`;
			}
			case 'day':
				return formatDate(this.currentDate, 'YYYY-MM-DD ddd');
			case 'task':
				return '任务视图';
		}
	}
}
