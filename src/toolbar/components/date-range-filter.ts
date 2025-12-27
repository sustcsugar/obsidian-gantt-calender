/**
 * @fileoverview 日期范围筛选器组件
 * @module toolbar/components/date-range-filter
 */

import { formatDate } from '../../dateUtils/dateUtilsIndex';

/**
 * 日期范围类型
 */
export type DateRangeType = 'all' | 'day' | 'week' | 'month' | 'custom';

/**
 * 日期范围状态
 */
export interface DateRangeState {
	type: DateRangeType;
	specificDate?: Date;
}

/**
 * 日期范围筛选器配置选项
 */
export interface DateRangeFilterOptions {
	/** 当前日期范围状态 */
	currentState: DateRangeState;
	/** 范围变化回调 */
	onRangeChange: (state: DateRangeState) => void;
	/** 容器样式类 */
	containerClass?: string;
	/** 日期输入框样式类 */
	inputClass?: string;
	/** 模式按钮样式类 */
	buttonClass?: string;
	/** 是否显示"全"选项 */
	showAllOption?: boolean;
	/** 自定义标签文本 */
	labelText?: string;
}

/**
 * 日期范围模式配置
 */
interface DateRangeMode {
	key: DateRangeType;
	label: string;
	title: string;
}

const DEFAULT_MODES: DateRangeMode[] = [
	{ key: 'all', label: '全', title: '全部时间' },
	{ key: 'day', label: '日', title: '按日筛选' },
	{ key: 'week', label: '周', title: '按周筛选' },
	{ key: 'month', label: '月', title: '按月筛选' }
];

/**
 * 渲染日期范围筛选器
 *
 * 特性：
 * - 日期输入框支持自定义日期
 * - 快捷按钮：全/日/周/月
 * - 自定义日期时清除按钮高亮
 * - 记录前一个模式用于恢复
 *
 * @param container 容器元素
 * @param options 配置选项
 * @returns 包含更新函数和清理函数的对象
 */
export function renderDateRangeFilter(
	container: HTMLElement,
	options: DateRangeFilterOptions
): { updateState: (state: DateRangeState) => void; cleanup: () => void } {
	const {
		currentState,
		onRangeChange,
		containerClass,
		inputClass = 'toolbar-right-task-date-input',
		buttonClass = 'toolbar-right-task-date-mode-btn',
		showAllOption = true,
		labelText = '日期'
	} = options;

	// 记录前一个模式（用于清除自定义日期后恢复）
	let previousMode: DateRangeType = 'week';

	// 创建日期筛选组容器
	const dateFilterGroup = container.createDiv('toolbar-right-task-date-filter-group');
	if (containerClass) dateFilterGroup.addClass(containerClass);

	// 创建标签
	const dateLabel = dateFilterGroup.createEl('span', {
		text: labelText,
		cls: 'toolbar-right-task-date-filter-label'
	});

	// 创建日期输入框
	const dateInput = dateFilterGroup.createEl('input', {
		cls: inputClass,
		attr: { type: 'date' }
	}) as HTMLInputElement;

	// 设置初始值
	if (currentState.specificDate) {
		try {
			dateInput.value = formatDate(currentState.specificDate, 'yyyy-MM-dd');
		} catch {
			dateInput.value = new Date().toISOString().slice(0, 10);
		}
	} else {
		try {
			dateInput.value = formatDate(new Date(), 'yyyy-MM-dd');
		} catch {
			dateInput.value = new Date().toISOString().slice(0, 10);
		}
	}

	// 存储模式按钮元素
	const modeButtons: Map<DateRangeType, HTMLElement> = new Map();

	// 输入变化处理
	dateInput.addEventListener('change', () => {
		const val = dateInput.value;
		if (val) {
			const d = new Date(val);
			onRangeChange({ type: 'custom', specificDate: d });
			// 清除所有按钮的高亮
			modeButtons.forEach(btn => btn.classList.remove('active'));
		} else {
			// 无输入时，恢复为前一个模式
			onRangeChange({ type: previousMode, specificDate: undefined });
			// 恢复前一个按钮的高亮
			const prevBtn = modeButtons.get(previousMode);
			if (prevBtn) prevBtn.classList.add('active');
		}
	});

	// 创建模式按钮
	const modes = showAllOption
		? DEFAULT_MODES
		: DEFAULT_MODES.filter(m => m.key !== 'all');

	modes.forEach((mode) => {
		const btn = dateFilterGroup.createEl('button', {
			cls: buttonClass,
			text: mode.label,
			attr: { 'data-mode': mode.key, title: mode.title }
		});

		// 根据当前状态设置高亮
		if (currentState.type !== 'custom' && mode.key === currentState.type) {
			btn.classList.add('active');
			// 更新 previousMode
			previousMode = mode.key;
		}

		btn.addEventListener('click', () => {
			// 清空输入框
			dateInput.value = '';
			// 保存当前模式为前一个状态
			previousMode = mode.key;
			// 更新状态
			const specificDate = mode.key !== 'all' ? new Date() : undefined;
			onRangeChange({ type: mode.key, specificDate });
			// 高亮切换
			modeButtons.forEach(b => b.classList.remove('active'));
			btn.classList.add('active');
		});

		modeButtons.set(mode.key, btn);
	});

	/**
	 * 更新筛选器状态
	 */
	const updateState = (state: DateRangeState) => {
		// 更新模式按钮高亮
		modeButtons.forEach((btn, key) => {
			if (state.type !== 'custom' && key === state.type) {
				btn.classList.add('active');
				previousMode = key;
			} else {
				btn.classList.remove('active');
			}
		});

		// 更新输入框
		if (state.specificDate) {
			try {
				dateInput.value = formatDate(state.specificDate, 'yyyy-MM-dd');
			} catch {
				// ignore
			}
		}
	};

	// 清理函数
	const cleanup = () => {
		modeButtons.clear();
		dateInput.remove();
		dateLabel.remove();
		dateFilterGroup.remove();
	};

	return { updateState, cleanup };
}
