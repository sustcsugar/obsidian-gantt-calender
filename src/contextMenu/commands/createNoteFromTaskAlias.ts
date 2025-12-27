import { App, Notice, normalizePath, TFolder, Modal, Setting } from 'obsidian';
import type { GanttTask } from '../../types';
import { updateTaskProperties } from '../../tasks/taskUpdater';

/**
 * 创建任务别名笔记
 * 先弹窗输入别名，再创建笔记，最后将任务行改为 [[别名]] 格式
 */
export async function createNoteFromTaskAlias(
	app: App,
	task: GanttTask,
	defaultPath: string,
	enabledFormats: string[] = ['tasks']
): Promise<void> {
	const alias = await promptForAlias(app, task);
	if (!alias) return;
	try {
		const baseDesc = cleanTaskDescriptionFromTask(task);
		const fileName = sanitizeFileName(alias);
		if (!fileName) {
			new Notice('笔记名称为空，无法创建文件');
			return;
		}
		await ensureFolderExists(app, defaultPath);
		const filePath = normalizePath(`${defaultPath}/${fileName}.md`);
		const existingFile = app.vault.getAbstractFileByPath(filePath);
		if (existingFile) {
			new Notice(`文件已存在: ${fileName}.md`);
			const leaf = app.workspace.getLeaf(false);
			await leaf.openFile(existingFile as any);
			await updateTaskProperties(app, task, { content: `[[${fileName}|${baseDesc}]]` }, enabledFormats);
			return;
		}
		const fileContent = `# ${alias}\n\n## 任务信息\n- 原任务: ${baseDesc}\n${task.tags && task.tags.length > 0 ? `- 标签: ${task.tags.map(t => `#${t}`).join(' ')}\n` : ''}`;
		const file = await app.vault.create(filePath, fileContent);
		const leaf = app.workspace.getLeaf(false);
		await leaf.openFile(file);
		new Notice(`已创建笔记: ${fileName}.md`);
		await updateTaskProperties(app, task, { content: `[[${fileName}|${baseDesc}]]` }, enabledFormats);
	} catch (error) {
		console.error('Failed to create alias note from task:', error);
		new Notice('创建别名笔记失败');
	}
}

function promptForAlias(app: App, task: GanttTask): Promise<string | null> {
	return new Promise((resolve) => {
		const modal = new AliasInputModal(app, resolve, task);
		modal.open();
	});
}

class AliasInputModal extends Modal {
	private onSubmit: (alias: string | null) => void;
	private task: GanttTask;
	constructor(app: App, onSubmit: (alias: string | null) => void, task: GanttTask) {
		super(app);
		this.onSubmit = onSubmit;
		this.task = task;
	}
	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: '输入笔记名称' });
		const input = contentEl.createEl('input', { type: 'text', value: '' });
		input.placeholder = '请输入笔记名称(任务描述为笔记别名)';
		input.style.width = '100%';
		input.focus();
		new Setting(contentEl)
			.addButton(btn => btn.setButtonText('确定').setCta().onClick(() => {
				const val = input.value.trim();
				this.close();
				this.onSubmit(val || null);
			}))
			.addButton(btn => btn.setButtonText('取消').onClick(() => {
				this.close();
				this.onSubmit(null);
			}));
		input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				const val = input.value.trim();
				this.close();
				this.onSubmit(val || null);
			}
		});
	}
	onClose() {
		this.contentEl.empty();
	}
}

// 以下工具函数可复用自 createNoteFromTask.ts
/**
 * 使用已解析的 task.description 清理任务描述（用于文件名生成）
 */
function cleanTaskDescriptionFromTask(task: GanttTask): string {
	let text = task.description || '';
	// 移除 wiki 链接语法，仅保留显示文本
	text = text.replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, ' $1 ');
	// 折叠多余空格
	text = text.replace(/\s{2,}/g, ' ').trim();
	return text;
}
function sanitizeFileName(name: string): string {
	return name.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().substring(0, 200);
}
async function ensureFolderExists(app: App, folderPath: string): Promise<void> {
	const normalizedPath = normalizePath(folderPath);
	const folder = app.vault.getAbstractFileByPath(normalizedPath);
	if (!folder) {
		await app.vault.createFolder(normalizedPath);
	}
}
