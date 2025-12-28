/**
 * 可见性管理器
 * 使用 Intersection Observer 管理任务卡片的显示/隐藏
 * 实现虚拟滚动效果
 */

// 实例计数器，用于生成唯一 ID
let instanceCounter = 0;

export interface VisibilityDebugOptions {
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

export interface VisibilityStats {
	/** 总项目数 */
	total: number;
	/** 可见项目数 */
	visible: number;
	/** 隐藏项目数 */
	hidden: number;
	/** 最后更新时间 */
	timestamp: number;
}

/**
 * 可见性管理器类
 *
 * 工作原理：
 * 1. 渲染所有任务的 DOM 节点
 * 2. 使用 Intersection Observer 监听每个元素的可见性
 * 3. 只显示可见区域 + 缓冲区内的任务
 * 4. 滚动时动态切换显示/隐藏状态
 */
export class VisibilityManager {
	private observer: IntersectionObserver | null = null;
	private observedItems = new Map<HTMLElement, (isVisible: boolean) => void>();
	private rootElement: HTMLElement;
	private bufferDistance: number;

	// Debug 相关
	private debug: VisibilityDebugOptions;
	private debugStats: VisibilityStats = { total: 0, visible: 0, hidden: 0, timestamp: 0 };
	private visibleItems = new Set<HTMLElement>();

	// 实例 ID，用于区分不同的日志
	private instanceId: string;

	// 滚动事件处理
	private scrollHandler?: () => void;
	private scrollTimeout?: number;
	private hasLoggedInitial = false;

	constructor(rootElement: HTMLElement, bufferDistance: number = 200, debugOptions?: VisibilityDebugOptions) {
		this.rootElement = rootElement;
		this.bufferDistance = bufferDistance;
		this.instanceId = `VM${++instanceCounter}`;
		this.debug = {
			enabled: debugOptions?.enabled ?? false,
			prefix: debugOptions?.prefix ?? '[VisibilityManager]',
			viewType: debugOptions?.viewType,
			dateRangeMode: debugOptions?.dateRangeMode,
			dateRangeDesc: debugOptions?.dateRangeDesc
		};

		this.log('init', `初始化 (${this.instanceId}) - bufferDistance: ${bufferDistance}px`);
		this.initObserver();
		this.initScrollListener();
	}

	/**
	 * 调试日志输出
	 */
	private log(category: string, message: string, data?: any): void {
		if (!this.debug.enabled) return;

		const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
		const prefix = `${this.debug.prefix} [${timestamp}]`;

		// 添加实例 ID 到日志前缀
		const instancePrefix = `${prefix} ${this.instanceId}`;

		switch (category) {
			case 'constructor':
			case 'init':
			case 'stats':
				console.log(`${instancePrefix} ${category.toUpperCase()}: ${message}`, data ?? '');
				break;
			case 'visibility':
				console.debug(`${instancePrefix} ${category.toUpperCase()}: ${message}`, data ?? '');
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
	 * 初始化 Intersection Observer
	 */
	private initObserver(): void {
		const options: IntersectionObserverInit = {
			root: this.rootElement,
			rootMargin: `${this.bufferDistance}px 0px ${this.bufferDistance}px 0px`,
			threshold: 0.01
		};

		this.observer = new IntersectionObserver((entries) => {
			this.handleIntersection(entries);
		}, options);
	}

	/**
	 * 初始化滚动监听（用于节流输出统计）
	 */
	private initScrollListener(): void {
		if (!this.debug.enabled) return;

		this.scrollHandler = () => {
			// 清除之前的超时
			if (this.scrollTimeout) {
				clearTimeout(this.scrollTimeout);
			}
			// 延迟 150ms 后输出统计（滚动停止后）
			this.scrollTimeout = window.setTimeout(() => {
				this.logStats();
			}, 150);
		};

		// 监听滚动事件
		this.rootElement.addEventListener('scroll', this.scrollHandler, { passive: true });
	}

	/**
	 * 处理 Intersection Observer 回调
	 */
	private handleIntersection(entries: IntersectionObserverEntry[]): void {
		let visibleCount = 0;
		let hiddenCount = 0;

		entries.forEach(entry => {
			const element = entry.target as HTMLElement;
			const callback = this.observedItems.get(element);

			if (callback) {
				const isVisible = entry.isIntersecting;

				if (isVisible) {
					this.visibleItems.add(element);
					visibleCount++;
				} else {
					this.visibleItems.delete(element);
					hiddenCount++;
				}

				callback(isVisible);
			}
		});

		// 更新统计
		this.debugStats.visible = this.visibleItems.size;
		this.debugStats.hidden = this.debugStats.total - this.debugStats.visible;
		this.debugStats.timestamp = Date.now();

		// 第一次完成检测后，输出初始统计
		if (!this.hasLoggedInitial && this.visibleItems.size > 0) {
			this.hasLoggedInitial = true;
			this.logStats();
		}
	}

	/**
	 * 获取元素标识（用于调试）
	 */
	private getElementId(element: HTMLElement): string {
		const id = element.id;
		const cls = element.className;
		const text = element.textContent?.slice(0, 20) ?? '';
		return id ? `#${id}` : (cls ? `.${cls.split(' ')[0]}` : `"${text}"`);
	}

	/**
	 * 观察一个元素
	 * @param element 要观察的 DOM 元素
	 * @param onVisibilityChange 可见性变化回调
	 */
	observe(element: HTMLElement, onVisibilityChange: (isVisible: boolean) => void): void {
		if (!this.observer) {
			this.initObserver();
		}

		this.observedItems.set(element, onVisibilityChange);
		this.observer?.observe(element);

		this.debugStats.total = this.observedItems.size;
	}

	/**
	 * 停止观察所有元素
	 */
	disconnect(): void {
		// 移除滚动监听
		if (this.scrollHandler) {
			this.rootElement.removeEventListener('scroll', this.scrollHandler);
		}
		if (this.scrollTimeout) {
			clearTimeout(this.scrollTimeout);
			this.scrollTimeout = undefined;
		}

		if (this.observer) {
			this.observer.disconnect();
		}

		this.observedItems.clear();
		this.visibleItems.clear();
		this.observer = null;
		this.hasLoggedInitial = false;
	}

	/**
	 * 刷新观察（用于数据更新后）
	 * 注意：需要重新观察所有元素
	 */
	refresh(): void {
		this.disconnect();
		this.initObserver();
		this.initScrollListener();
	}

	/**
	 * 获取当前统计信息
	 */
	getStats(): VisibilityStats {
		return {
			total: this.observedItems.size,
			visible: this.visibleItems.size,
			hidden: this.observedItems.size - this.visibleItems.size,
			timestamp: Date.now()
		};
	}

	/**
	 * 输出统计信息
	 */
	logStats(): void {
		const stats = this.getStats();
		const visiblePercent = stats.total > 0
			? ((stats.visible / stats.total) * 100).toFixed(1)
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
			`${context} 统计 - 总数: ${stats.total}, 可见: ${stats.visible} (${visiblePercent}%), 隐藏: ${stats.hidden}`
		);
	}

	/**
	 * 显示调试信息到页面（用于可视化调试）
	 */
	showDebugInfo(container?: HTMLElement): void {
		if (!this.debug.enabled) return;

		const stats = this.getStats();
		const info = `
总任务数: ${stats.total}
可见任务: ${stats.visible}
隐藏任务: ${stats.hidden}
缓冲距离: ${this.bufferDistance}px
		`.trim();

		if (container) {
			container.innerHTML = `<pre style="font-size:10px;background:var(--background-secondary);padding:8px;">${info}</pre>`;
		} else {
			console.log(`${this.debug.prefix} === Debug Info ===\n${info}`);
		}
	}

	/**
	 * 销毁管理器
	 */
	destroy(): void {
		this.disconnect();
	}

	/**
	 * 启用/禁用调试模式
	 */
	setDebugEnabled(enabled: boolean): void {
		const wasEnabled = this.debug.enabled;
		this.debug.enabled = enabled;

		if (enabled && !wasEnabled) {
			// 启用调试模式，添加滚动监听
			this.initScrollListener();
			this.log('init', `调试模式: 启用`);
		} else if (!enabled && wasEnabled) {
			// 禁用调试模式，移除滚动监听
			if (this.scrollHandler) {
				this.rootElement.removeEventListener('scroll', this.scrollHandler);
			}
			if (this.scrollTimeout) {
				clearTimeout(this.scrollTimeout);
				this.scrollTimeout = undefined;
			}
		}
	}
}
