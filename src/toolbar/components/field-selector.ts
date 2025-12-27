/**
 * @fileoverview 字段选择器组件（时间字段类型选择）
 * @module toolbar/components/field-selector
 */

/**
 * 时间字段类型
 */
export type DateFieldType =
	| 'createdDate'
	| 'startDate'
	| 'scheduledDate'
	| 'dueDate'
	| 'completionDate'
	| 'cancelledDate';

/**
 * 时间字段选项配置
 */
export interface DateFieldOption {
	/** 字段值 */
	value: DateFieldType;
	/** 显示标签 */
	label: string;
	/** 显示图标 */
	icon: string;
}

/**
 * 默认时间字段选项
 */
export const DEFAULT_DATE_FIELD_OPTIONS: DateFieldOption[] = [
	{ value: 'createdDate', label: '创建时间', icon: '➕' },
	{ value: 'startDate', label: '开始时间', icon: '🛫' },
	{ value: 'scheduledDate', label: '计划时间', icon: '⏳' },
	{ value: 'dueDate', label: '截止时间', icon: '📅' },
	{ value: 'completionDate', label: '完成时间', icon: '✅' },
	{ value: 'cancelledDate', label: '取消时间', icon: '❌' }
];

/**
 * 字段选择器配置选项
 */
export interface FieldSelectorOptions {
	/** 当前选中的字段 */
	currentField: DateFieldType;
	/** 字段变化回调 */
	onFieldChange: (field: DateFieldType) => void;
	/** 标签文本 */
	label?: string;
	/** 要排除的字段选项 */
	excludeFields?: DateFieldType[];
	/** 自定义字段选项 */
	customOptions?: DateFieldOption[];
	/** 容器样式类 */
	containerClass?: string;
	/** 标签样式类 */
	labelClass?: string;
	/** 选择器样式类 */
	selectClass?: string;
}

/**
 * 渲染字段选择器（下拉选择时间字段类型）
 *
 * 特性：
 * - 下拉选择时间字段
 * - 支持自定义标签
 * - 支持排除某些字段选项
 * - 支持自定义字段选项列表
 *
 * @param container 容器元素
 * @param options 配置选项
 * @returns 包含更新函数和清理函数的对象
 */
export function renderFieldSelector(
	container: HTMLElement,
	options: FieldSelectorOptions
): { updateValue: (field: DateFieldType) => void; cleanup: () => void } {
	const {
		currentField,
		onFieldChange,
		label = '字段筛选',
		excludeFields = [],
		customOptions,
		containerClass,
		labelClass = 'toolbar-right-task-field-filter-label',
		selectClass = 'toolbar-right-task-field-select'
	} = options;

	// 创建字段筛选组
	const fieldFilterGroup = container.createDiv('toolbar-field-filter-group');
	if (containerClass) fieldFilterGroup.addClass(containerClass);

	// 创建标签
	const fieldLabel = fieldFilterGroup.createEl('span', {
		text: label,
		cls: labelClass
	});

	// 创建选择器
	const fieldSelect = fieldFilterGroup.createEl('select', {
		cls: selectClass
	}) as HTMLSelectElement;

	// 获取字段选项
	const fieldOptions = customOptions || DEFAULT_DATE_FIELD_OPTIONS;

	// 添加选项
	fieldOptions.forEach((option) => {
		if (excludeFields.includes(option.value)) return;

		const opt = document.createElement('option');
		opt.value = option.value;
		opt.textContent = `${option.icon} ${option.label}`;
		fieldSelect.appendChild(opt);
	});

	// 设置当前值
	fieldSelect.value = currentField;

	// 绑定变化事件
	fieldSelect.addEventListener('change', (e) => {
		const value = (e.target as HTMLSelectElement).value as DateFieldType;
		onFieldChange(value);
	});

	/**
	 * 更新当前选中的字段
	 */
	const updateValue = (field: DateFieldType) => {
		fieldSelect.value = field;
	};

	// 清理函数
	const cleanup = () => {
		fieldSelect.remove();
		fieldLabel.remove();
		fieldFilterGroup.remove();
	};

	return { updateValue, cleanup };
}

/**
 * 创建双字段选择器（开始时间+结束时间）
 */
export interface DualFieldSelectorOptions {
	startField: DateFieldType;
	endField: DateFieldType;
	onStartFieldChange: (field: DateFieldType) => void;
	onEndFieldChange: (field: DateFieldType) => void;
	containerClass?: string;
	labelClass?: string;
	selectClass?: string;
	excludeFields?: DateFieldType[];
}

export function renderDualFieldSelector(
	container: HTMLElement,
	options: DualFieldSelectorOptions
): { updateStart: (field: DateFieldType) => void; updateEnd: (field: DateFieldType) => void; cleanup: () => void } {
	const {
		startField,
		endField,
		onStartFieldChange,
		onEndFieldChange,
		containerClass,
		labelClass = 'toolbar-gantt-field-label',
		selectClass = 'toolbar-gantt-field-select',
		excludeFields = []
	} = options;

	const wrapper = container.createDiv('toolbar-dual-field-selector-wrapper');
	if (containerClass) wrapper.addClass(containerClass);

	// 开始时间选择器
	const startResult = renderFieldSelector(wrapper, {
		currentField: startField,
		onFieldChange: onStartFieldChange,
		label: '开始时间',
		excludeFields,
		labelClass,
		selectClass
	});

	// 结束时间选择器
	const endResult = renderFieldSelector(wrapper, {
		currentField: endField,
		onFieldChange: onEndFieldChange,
		label: '结束时间',
		excludeFields,
		labelClass,
		selectClass
	});

	// 清理函数
	const cleanup = () => {
		startResult.cleanup();
		endResult.cleanup();
		wrapper.remove();
	};

	return {
		updateStart: startResult.updateValue,
		updateEnd: endResult.updateValue,
		cleanup
	};
}

/**
 * 创建简化版字段选择器（甘特图专用）
 */
export interface GanttFieldSelectorOptions extends Omit<FieldSelectorOptions, 'label'> {
	/** 选择器类型：start 或 end */
	selectorType: 'start' | 'end';
}

export function renderGanttFieldSelector(
	container: HTMLElement,
	options: GanttFieldSelectorOptions
): { updateValue: (field: DateFieldType) => void; cleanup: () => void } {
	const { selectorType, ...rest } = options;

	return renderFieldSelector(container, {
		...rest,
		label: selectorType === 'start' ? '开始时间' : '结束时间',
		labelClass: 'toolbar-gantt-field-label',
		selectClass: 'toolbar-gantt-field-select',
		containerClass: 'toolbar-gantt-field-group'
	});
}
