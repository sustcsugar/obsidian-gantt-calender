/**
 * 真正的虚拟滚动管理器
 *
 * 工作原理：
 * 1. 使用占位符保持滚动条高度
 * 2. 只渲染可见区域 + 缓冲区的元素
 * 3. 滚动时动态创建/销毁 DOM
 * 4. 使用 transform 定位元素
 */

// 实例计数器
let instanceCounter = 0;

export interface VirtualScrollDebugOptions {
	/** 是否启用调试日志 */
	enabled?: boolean;
	/** 日志前缀 */
	prefix?: string;
	/** 视图类型（用于日志） */
	viewType?: string;
	/** 日期范围模式（用于日志） */
	dateRangeMode?: string;
	/** 日期范围描述（用于日志） */
	dateRangeDesc?: string;
}

export interface VirtualScrollConfig<T> {
	/** 数据源 */
	items: T[];
	/** 预估项高度（像素） */
	estimatedItemHeight: number;
	/** 缓冲区大小（像素） - 可见区域外额外渲染的缓冲 */
	bufferSize?: number;
	/** 渲染函数 */
	renderItem: (item: T, index: number) => HTMLElement;
	/** 更新函数（用于更新已存在的元素） */
	updateItem?: (element: HTMLElement, item: T, index: number) => void;
	/** 容器元素 */
	container: HTMLElement;
	/** 调试选项 */
	debug?: VirtualScrollDebugOptions;
}

export interface VirtualScrollStats {
	/** 总项目数 */
	total: number;
	/** 渲染的项目数 */
	rendered: number;
	/** 可见区域项目数 */
	visible: number;
	/** 占位符高度 */
	placeholderHeight: number;
}

export class VirtualScrollManager<T> {
	private items: T[] = [];
	private estimatedItemHeight: number;
	private bufferSize: number;
	private renderItem: (item: T, index: number) => HTMLElement;
	private updateItem?: (element: HTMLElement, item: T, index: number) => void;
	private container: HTMLElement;
	private debug: VirtualScrollDebugOptions;

	// 实例 ID
	private instanceId: string;

	// DOM 元素
	private placeholder: HTMLElement;
	private viewport: HTMLElement;
	private scrollContainer: HTMLElement;

	// 渲染状态
	private renderedItems = new Map<number, { element: HTMLElement; item: T }>();
	private firstRenderedIndex = -1;
	private lastRenderedIndex = -1;

	// 滚动处理
	private scrollHandler?: () => void;
	private scrollTimeout?: number;
	private isDestroyed = false;

	// 调试
	private hasLoggedInitial = false;

	constructor(config: VirtualScrollConfig<T>) {
		this.items = config.items;
		this.estimatedItemHeight = config.estimatedItemHeight;
		this.bufferSize = config.bufferSize ?? 200;
		this.renderItem = config.renderItem;
		this.updateItem = config.updateItem;
		this.container = config.container;
		this.debug = {
			enabled: config.debug?.enabled ?? false,
			prefix: config.debug?.prefix ?? '[VirtualScroll]',
			viewType: config.debug?.viewType,
			dateRangeMode: config.debug?.dateRangeMode,
			dateRangeDesc: config.debug?.dateRangeDesc
		};
		this.instanceId = `VS${++instanceCounter}`;

		this.log('init', `初始化 (${this.instanceId}) - 项目数: ${this.items.length}, 预估高度: ${this.estimatedItemHeight}px`);

		this.initDOM();
		this.initScrollListener();
		this.render(); // 初始渲染
	}

	/**
	 * 初始化 DOM 结构
	 */
	private initDOM(): void {
		// 创建滚动容器
		this.scrollContainer = this.container.createDiv('gc-virtual-scroll-container');
		this.scrollContainer.style.cssText = `
			position: relative;
			height: 100%;
			overflow-y: auto;
			overflow-x: hidden;
		`;

		// 创建占位符（保持滚动条高度）
		this.placeholder = this.scrollContainer.createDiv('gc-virtual-scroll-placeholder');
		this.updatePlaceholderHeight();

		// 创建视口（用于存放实际渲染的元素）
		this.viewport = this.scrollContainer.createDiv('gc-virtual-scroll-viewport');
		this.viewport.style.cssText = `
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			pointer-events: none; /* 让事件穿透到子元素 */
		`;

		this.log('init', `DOM 初始化完成 - 占位符高度: ${this.placeholder.style.height}`);
	}

	/**
	 * 更新占位符高度
	 */
	private updatePlaceholderHeight(): void {
		const totalHeight = this.items.length * this.estimatedItemHeight;
		this.placeholder.style.height = `${totalHeight}px`;
	}

	/**
	 * 初始化滚动监听
	 */
	private initScrollListener(): void {
		if (!this.debug.enabled) return;

		this.scrollHandler = () => {
			if (this.scrollTimeout) {
				clearTimeout(this.scrollTimeout);
			}
			this.scrollTimeout = window.setTimeout(() => {
				this.logStats();
			}, 150);
		};

		this.scrollContainer.addEventListener('scroll', this.scrollHandler, { passive: true });
	}

	/**
	 * 调试日志输出
	 */
	private log(category: string, message: string, data?: any): void {
		if (!this.debug.enabled) return;

		const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
		const prefix = `${this.debug.prefix} [${timestamp}]`;
		const instancePrefix = `${prefix} ${this.instanceId}`;

		switch (category) {
			case 'init':
			case 'stats':
			case 'render':
				console.log(`${instancePrefix} ${category.toUpperCase()}: ${message}`, data ?? '');
				break;
			case 'warning':
				console.warn(`${instancePrefix} WARNING: ${message}`, data ?? '');
				break;
			case 'error':
				console.error(`${instancePrefix} ERROR: ${message}`, data ?? '');
				break;
		}
	}

	/**
	 * 计算可见范围
	 */
	private calculateVisibleRange(): { startIndex: number; endIndex: number } {
		const scrollTop = this.scrollContainer.scrollTop;
		const containerHeight = this.scrollContainer.clientHeight;

		// 计算可见范围（添加缓冲区）
		const startOffset = Math.max(0, scrollTop - this.bufferSize);
		const endOffset = scrollTop + containerHeight + this.bufferSize;

		const startIndex = Math.floor(startOffset / this.estimatedItemHeight);
		const endIndex = Math.ceil(endOffset / this.estimatedItemHeight);

		return {
			startIndex: Math.max(0, startIndex),
			endIndex: Math.min(this.items.length - 1, endIndex)
		};
	}

	/**
	 * 渲染可见区域的项目
	 */
	private render(): void {
		if (this.isDestroyed) return;

		const { startIndex, endIndex } = this.calculateVisibleRange();

		// 如果范围没有变化，不需要重新渲染
		if (startIndex === this.firstRenderedIndex && endIndex === this.lastRenderedIndex) {
			return;
		}

		this.log('render', `渲染范围: ${startIndex} - ${endIndex} (${endIndex - startIndex + 1} 个项目)`);

		// 移除不再可见的元素
		for (const index of this.renderedItems.keys()) {
			if (index < startIndex || index > endIndex) {
				this.removeItem(index);
			}
		}

		// 渲染新的可见元素
		for (let i = startIndex; i <= endIndex; i++) {
			if (!this.renderedItems.has(i)) {
				this.addItem(i);
			}
		}

		// 更新视口位置
		this.updateViewportPosition();

		this.firstRenderedIndex = startIndex;
		this.lastRenderedIndex = endIndex;

		// 首次渲染完成后输出统计
		if (!this.hasLoggedInitial && this.renderedItems.size > 0) {
			this.hasLoggedInitial = true;
			this.logStats();
		}
	}

	/**
	 * 添加一个项目
	 */
	private addItem(index: number): void {
		const item = this.items[index];
		if (!item) return;

		const element = this.renderItem(item, index);
		element.style.pointerEvents = 'auto'; // 恢复子元素的事件响应
		element.dataset.virtualIndex = String(index);

		this.viewport.appendChild(element);
		this.renderedItems.set(index, { element, item });
	}

	/**
	 * 移除一个项目
	 */
	private removeItem(index: number): void {
		const rendered = this.renderedItems.get(index);
		if (rendered) {
			rendered.element.remove();
			this.renderedItems.delete(index);
		}
	}

	/**
	 * 更新视口位置
	 */
	private updateViewportPosition(): void {
		const translateY = this.firstRenderedIndex * this.estimatedItemHeight;
		this.viewport.style.transform = `translateY(${translateY}px)`;
	}

	/**
	 * 处理滚动事件
	 */
	private handleScroll = (): void => {
		if (this.isDestroyed) return;
		requestAnimationFrame(() => this.render());
	};

	/**
	 * 更新数据源
	 */
	updateItems(newItems: T[]): void {
		this.items = newItems;
		this.updatePlaceholderHeight();

		// 清空所有渲染的元素
		for (const index of this.renderedItems.keys()) {
			this.removeItem(index);
		}
		this.firstRenderedIndex = -1;
		this.lastRenderedIndex = -1;

		this.render();
		this.log('render', `数据更新 - 新项目数: ${newItems.length}`);
	}

	/**
	 * 更新单个项目的数据
	 */
	updateItemData(index: number, item: T): void {
		if (index < 0 || index >= this.items.length) return;

		this.items[index] = item;

		// 如果该项目已渲染，更新它
		const rendered = this.renderedItems.get(index);
		if (rendered && this.updateItem) {
			this.updateItem(rendered.element, item, index);
		}
	}

	/**
	 * 获取统计信息
	 */
	getStats(): VirtualScrollStats {
		const containerHeight = this.scrollContainer.clientHeight;
		const visibleCount = Math.ceil(containerHeight / this.estimatedItemHeight);

		return {
			total: this.items.length,
			rendered: this.renderedItems.size,
			visible: visibleCount,
			placeholderHeight: this.items.length * this.estimatedItemHeight
		};
	}

	/**
	 * 输出统计信息
	 */
	logStats(): void {
		const stats = this.getStats();
		const renderedPercent = stats.total > 0
			? ((stats.rendered / stats.total) * 100).toFixed(1)
			: '0.0';

		// 构建上下文信息
		const contextParts: string[] = [];
		if (this.debug.viewType) {
			contextParts.push(`视图:${this.debug.viewType}`);
		}
		if (this.debug.dateRangeMode) {
			contextParts.push(`范围:${this.debug.dateRangeMode}`);
		}
		if (this.debug.dateRangeDesc) {
			contextParts.push(`日期:${this.debug.dateRangeDesc}`);
		}

		const context = contextParts.length > 0 ? ` [${contextParts.join(' | ')}]` : '';

		this.log('stats',
			`${context} 统计 - 总数: ${stats.total}, 渲染: ${stats.rendered} (${renderedPercent}%), 可见: ${stats.visible}, 占位符: ${stats.placeholderHeight}px`
		);
	}

	/**
	 * 启用滚动监听
	 */
	enableScrollListener(): void {
		if (!this.scrollHandler) {
			this.scrollHandler = this.handleScroll;
		}
		this.scrollContainer.addEventListener('scroll', this.handleScroll, { passive: true });
		this.log('init', '滚动监听已启用');
	}

	/**
	 * 禁用滚动监听
	 */
	disableScrollListener(): void {
		if (this.scrollHandler) {
			this.scrollContainer.removeEventListener('scroll', this.handleScroll);
		}
		this.log('init', '滚动监听已禁用');
	}

	/**
	 * 滚动到指定索引
	 */
	scrollToIndex(index: number, behavior: ScrollBehavior = 'auto'): void {
		if (index < 0 || index >= this.items.length) return;

		const scrollTop = index * this.estimatedItemHeight;
		this.scrollContainer.scrollTo({
			top: scrollTop,
			behavior
		});
	}

	/**
	 * 获取滚动容器
	 */
	getScrollContainer(): HTMLElement {
		return this.scrollContainer;
	}

	/**
	 * 销毁管理器
	 */
	destroy(): void {
		this.isDestroyed = true;

		// 移除事件监听
		if (this.scrollHandler) {
			this.scrollContainer.removeEventListener('scroll', this.handleScroll);
		}
		if (this.scrollHandler && this.debug.enabled) {
			this.scrollContainer.removeEventListener('scroll', this.scrollHandler!);
		}
		if (this.scrollTimeout) {
			clearTimeout(this.scrollTimeout);
		}

		// 清空所有渲染的元素
		for (const { element } of this.renderedItems.values()) {
			element.remove();
		}
		this.renderedItems.clear();

		// 移除 DOM 元素
		this.scrollContainer.remove();

		this.log('init', `销毁 (${this.instanceId})`);
	}
}
