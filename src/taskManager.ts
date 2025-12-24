import { App, TFile } from 'obsidian';
import { GanttTask } from './types';
import { parseTasksFromListItems } from './tasks/taskParser';
import { areTasksEqual } from './tasks/taskUtils';
// 任务更新相关函数已迁移至 tasks/taskUpdater.ts，此处重新导出以保持向后兼容
export {
	updateTaskCompletion,
	updateTaskDateField,
	updateTaskProperties,
} from './tasks/taskUpdater';

// 任务解析与搜索相关功能已迁移至 src/tasks/ 目录


export type TaskCacheUpdateListener = () => void;

/**
 * 任务缓存管理器 - 全局单例，用于提升性能
 *
 * 核心功能：
 * 1. 初始化时扫描整个笔记库，缓存所有任务
 * 2. 监听文件变化，增量更新受影响文件的任务
 * 3. 提供快速的任务查询接口，避免重复扫描
 * 4. 当任务缓存更新时，通知所有订阅的监听器
 */
export class TaskCacheManager {
	private app: App;
	private cache: Map<string, GanttTask[]> = new Map(); // 文件路径 -> 任务列表
	private globalTaskFilter: string = '';
	private enabledFormats: string[] = ['tasks', 'dataview'];
	private isInitialized: boolean = false;
	private isInitializing: boolean = false;
	private updateListeners: Set<TaskCacheUpdateListener> = new Set();

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * 初始化缓存 - 扫描整个笔记库
	 */
	async initialize(globalTaskFilter: string, enabledFormats?: string[], retryCount: number = 0): Promise<void> {
		if (this.isInitializing) {
			console.log('[TaskCache] Already initializing, skipping...');
			return;
		}

		this.isInitializing = true;
		this.globalTaskFilter = (globalTaskFilter || '').trim();
		this.enabledFormats = enabledFormats || ['tasks', 'dataview'];

		this.cache.clear();
		let markdownFiles = this.app.vault.getMarkdownFiles();

		// 如果首次扫描找不到文件，可能 vault 尚未初始化，等待后重试
		if (markdownFiles.length === 0 && retryCount < 3) {
			console.log(`[TaskCache] Vault not ready (${markdownFiles.length} files found), retrying in 500ms...`);
			this.isInitializing = false;
			await new Promise(resolve => setTimeout(resolve, 500));
			return this.initialize(globalTaskFilter, enabledFormats, retryCount + 1);
		}

		// 仅在实际扫描时开始计时，避免重试时重复 console.time
		const timerLabel = retryCount === 0 ? '[TaskCache] Initial scan' : `[TaskCache] Initial scan (retry ${retryCount})`;
		console.time(timerLabel);
		console.log('[TaskCache] Starting initial scan...');

		// 批量处理文件，避免阻塞UI
		const batchSize = 50;
		let scannedFiles = 0;
		let filesWithTasks = 0;
		let totalTasks = 0;
		for (let i = 0; i < markdownFiles.length; i += batchSize) {
			const batch = markdownFiles.slice(i, i + batchSize);
			const batchResults = await Promise.all(batch.map(async (file) => {
				const info = await this.updateFileCache(file, true, true);
				return info;
			}));
			batchResults.forEach(info => {
				if (!info) return;
				scannedFiles += 1;
				if (info.taskCount > 0) filesWithTasks += 1;
				totalTasks += info.taskCount;
			});

			// 让出主线程，避免卡顿
			if (i % 200 === 0) {
				await new Promise(resolve => setTimeout(resolve, 0));
			}
		}

		this.isInitialized = true;
		this.isInitializing = false;

		// 完成批量扫描后统一通知，避免在初始化阶段触发大量视图重渲染
		this.notifyListeners();

		const cachedTasks = Array.from(this.cache.values()).reduce((sum, tasks) => sum + tasks.length, 0);
		console.timeEnd(timerLabel);
		console.log('[TaskCache] Init summary', {
			totalFiles: markdownFiles.length,
			scannedFiles,
			filesWithTasks,
			tasksFound: totalTasks,
			cachedTasks,
		});
	}

	/**
	 * 更新单个文件的缓存
	 */
	async updateFileCache(file: TFile, silent?: boolean, suppressNotify?: boolean): Promise<{ taskCount: number } | null> {
		try {
			const fileCache = this.app.metadataCache.getFileCache(file);
			const listItems = fileCache?.listItems;

			// 如果没有列表项，移除缓存并仅在有变动时通知
			if (!listItems || listItems.length === 0) {
				if (this.cache.has(file.path)) {
					this.cache.delete(file.path);
					if (!suppressNotify) {
						this.notifyListeners();
					}
				}
				return { taskCount: 0 };
			}

			const content = await this.app.vault.read(file);
			const lines = content.split('\n');
			const tasks = parseTasksFromListItems(file, lines, listItems, this.enabledFormats, this.globalTaskFilter);

			const prev = this.cache.get(file.path) || [];
			if (areTasksEqual(prev, tasks)) {
				// 无变化不通知
				return { taskCount: tasks.length };
			}

			if (tasks.length > 0) {
				this.cache.set(file.path, tasks);
			} else {
				this.cache.delete(file.path);
			}

			if (!silent) {
				console.log('[TaskCache] Updated file', file.path, { taskCount: tasks.length });
			}
			if (!suppressNotify) {
				this.notifyListeners();
			}
			return { taskCount: tasks.length };
		} catch (error) {
			console.error(`[TaskCache] Error updating cache for ${file.path}:`, error);
			this.cache.delete(file.path);
			return { taskCount: 0 };
		}
	}

	/**
	 * 移除文件的缓存
	 */
	removeFileCache(filePath: string): void {
		this.cache.delete(filePath);
	}

	/**
	 * 获取所有任务（从缓存）
	 */
	getAllTasks(): GanttTask[] {
		// 即使初始化未完成，也返回当前已解析的缓存，避免界面空白
		const allTasks: GanttTask[] = [];
		for (const tasks of this.cache.values()) {
			allTasks.push(...tasks);
		}

		return allTasks.sort((a, b) => {
			if (a.fileName !== b.fileName) {
				return a.fileName.localeCompare(b.fileName);
			}
			return a.lineNumber - b.lineNumber;
		});
	}

	/**
	 * 更新配置并重新初始化
	 */
	async updateSettings(globalTaskFilter: string, enabledFormats?: string[]): Promise<void> {
		const trimmedFilter = (globalTaskFilter || '').trim();
		const needsReinit =
			this.globalTaskFilter !== trimmedFilter ||
			JSON.stringify(this.enabledFormats) !== JSON.stringify(enabledFormats);

		if (needsReinit) {
			console.log('[TaskCache] Settings changed, reinitializing cache...');
			await this.initialize(trimmedFilter, enabledFormats);
		}
	}

	/**
	 * 获取缓存状态
	 */
	getStatus(): { initialized: boolean; fileCount: number; taskCount: number } {
		const taskCount = Array.from(this.cache.values()).reduce((sum, tasks) => sum + tasks.length, 0);
		return {
			initialized: this.isInitialized,
			fileCount: this.cache.size,
			taskCount
		};
	}

	/**
	 * 清空缓存
	 */
	clear(): void {
		this.cache.clear();
		this.isInitialized = false;
		console.log('[TaskCache] Cache cleared');
	}

	/**
	 * 订阅缓存更新事件
	 */
	onUpdate(listener: TaskCacheUpdateListener): void {
		this.updateListeners.add(listener);
	}

	/**
	 * 取消订阅缓存更新事件
	 */
	offUpdate(listener: TaskCacheUpdateListener): void {
		this.updateListeners.delete(listener);
	}

	/**
	 * 通知所有监听器，缓存已更新
	 */
	private notifyListeners(): void {
		this.updateListeners.forEach(listener => {
			try {
				listener();
			} catch (error) {
				console.error('[TaskCache] Error in update listener:', error);
			}
		});
	}
}
