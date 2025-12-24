import { App, MarkdownView, TFile } from 'obsidian';

/**
 * Open file in existing leaf if already open, otherwise create a new tab
 */
export async function openFileInExistingLeaf(app: App, filePath: string, lineNumber?: number) {
	const file = app.vault.getAbstractFileByPath(filePath);
	if (!(file instanceof TFile)) return;

	const { workspace } = app;

	// Find an already open markdown leaf for the same file
	const existingLeaf = workspace.getLeavesOfType('markdown').find((leaf) => {
		const view = leaf.view as MarkdownView;
		return view?.file?.path === file.path;
	});

	let leaf = existingLeaf;

	if (!leaf) {
		// Open in a new tab if not already open
		leaf = workspace.getLeaf('tab');
		await leaf.openFile(file);
	} else {
		// Focus the existing tab
		workspace.setActiveLeaf(leaf, { focus: true });
	}

	// Ensure the file is loaded in the leaf (safety)
	const view = leaf.view as MarkdownView;
	if (!view?.file || view.file.path !== file.path) {
		await leaf.openFile(file);
	}

	// Jump to the target line if provided
	if (lineNumber && lineNumber > 0) {
		const editor = view?.editor;
		if (editor) {
			editor.setCursor({ line: lineNumber - 1, ch: 0 });
		}
	}

	workspace.revealLeaf(leaf);
}
