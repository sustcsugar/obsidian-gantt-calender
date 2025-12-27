import { App, Modal, Setting } from 'obsidian';
import type { GanttTask } from '../../types';
import {
	createNoteFromTaskCore,
	checkExistingWikiLink,
	openExistingNote,
	cleanTaskDescriptionFromTask,
	sanitizeFileName,
	type CreateNoteOptions,
} from './createNoteFromTask';

/**
 * 创建任务别名笔记
 * 先检查是否已存在双链，再弹窗输入别名，创建笔记
 */
export async function createNoteFromTaskAlias(
	app: App,
	task: GanttTask,
	defaultPath: string,
	enabledFormats: string[] = ['tasks']
): Promise<void> {
	// 1) 先检查任务中是否已存在双链，如果有则直接打开
	const existingLink = checkExistingWikiLink(task, app);
	if (existingLink) {
		await openExistingNote(app, task, existingLink);
		return;
	}

	// 2) 弹窗输入别名
	const alias = await promptForAlias(app, task);
	if (!alias) return;

	// 清理原任务描述（用于显示文本）
	const baseDesc = cleanTaskDescriptionFromTask(task);
	const fileName = sanitizeFileName(alias);

	// wiki 链接内容（带别名的显示文本）
	const wikiLinkContent = `[[${fileName}|${baseDesc}]]`;

	// 创建选项
	const options: CreateNoteOptions = {
		wikiLinkContent,
		displayText: baseDesc,
	};

	await createNoteFromTaskCore(app, task, defaultPath, fileName, options, enabledFormats);
}

// ==================== 弹窗组件 ====================

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
