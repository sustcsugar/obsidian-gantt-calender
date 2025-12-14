import { App, Editor, MarkdownView, Modal, Notice, Plugin } from 'obsidian';
import { CalendarView, CALENDAR_VIEW_ID } from './src/CalendarView';
import { GanttCalendarSettings, DEFAULT_SETTINGS, GanttCalendarSettingTab } from './src/settings';
import { searchTasks } from './src/taskManager';
import { TaskListModal } from './src/taskModal';
import { TaskView, TASK_VIEW_ID } from './src/TaskView';

export default class GanttCalendarPlugin extends Plugin {
    settings: GanttCalendarSettings;

    async onload() {
        await this.loadSettings();

        // Register the calendar view
        this.registerView(CALENDAR_VIEW_ID, (leaf) => new CalendarView(leaf, this));
        // Register the task management view
        this.registerView(TASK_VIEW_ID, (leaf) => new TaskView(leaf, this));

        // This creates an icon in the left ribbon.
        const ribbonIconEl = this.addRibbonIcon('calendar-days', '甘特日历', (evt: MouseEvent) => {
            // Open calendar view in a new leaf in main editor
            this.activateView();
        });
        ribbonIconEl.addClass('gantt-calendar-ribbon');

        // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
        const statusBarItemEl = this.addStatusBarItem();
        statusBarItemEl.setText('Status Bar Text');

        // This adds a simple command that can be triggered anywhere
        this.addCommand({
            id: 'gantt-calendar-common',
            name: 'Open sample modal (simple)',
            callback: () => {
                new SampleModal(this.app).open();
            }
        });
        // This adds an editor command that can perform some operation on the current editor instance
        this.addCommand({
            id: 'gantt-calendar-editor',
            name: 'Sample editor command',
            editorCallback: (editor: Editor, _view: MarkdownView) => {
                console.log(editor.getSelection());
                editor.replaceSelection('Sample Editor Command');
            }
        });
        // This adds a complex command that can check whether the current state of the app allows execution of the command
        this.addCommand({
            id: 'gantt-calendar-conditional',
            name: 'Open sample modal (complex)',
            checkCallback: (checking: boolean) => {
                // Conditions to check
                const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (markdownView) {
                    // If checking is true, we're simply "checking" if the command can be run.
                    // If checking is false, then we want to actually perform the operation.
                    if (!checking) {
                        new SampleModal(this.app).open();
                    }

                    // This command will only show up in Command Palette when the check function returns true
                    return true;
                }
            }
        });

        // Open dedicated task view
        this.addCommand({
            id: 'gantt-calendar-open-task-view',
            name: '打开任务视图',
            callback: async () => {
                await this.activateTaskView();
            }
        });

        // Search all tasks with global filter
        this.addCommand({
            id: 'gantt-calendar-search-tasks',
            name: '搜索所有任务',
            callback: async () => {
                try {
                    const tasks = await searchTasks(this.app, this.settings.globalTaskFilter);
                    new TaskListModal(this.app, tasks).open();
                    new Notice(`找到 ${tasks.length} 个任务`);
                } catch (error) {
                    console.error('Error searching tasks:', error);
                    new Notice('搜索任务时出错');
                }
            }
        });

        // This adds a settings tab so the user can configure various aspects of the plugin
        this.addSettingTab(new GanttCalendarSettingTab(this.app, this));

        // If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
        // Using this function will automatically remove the event listener when this plugin is disabled.
        this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
            console.log('click', evt);
        });

        // When registering intervals, this function will automatically clear the interval when the plugin is disabled.
        this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
    }

    onunload() {
        this.app.workspace.getLeavesOfType(CALENDAR_VIEW_ID).forEach(leaf => leaf.detach());
        this.app.workspace.getLeavesOfType(TASK_VIEW_ID).forEach(leaf => leaf.detach());
    }

    async activateView() {
        const { workspace } = this.app;

        let leaf = workspace.getLeavesOfType(CALENDAR_VIEW_ID)[0];
        if (!leaf) {
            // Create new leaf in main area
            leaf = workspace.getLeaf('tab');
            await leaf.setViewState({
                type: CALENDAR_VIEW_ID,
                active: true,
            });
        }

        workspace.revealLeaf(leaf);
    }

    async activateTaskView() {
        const { workspace } = this.app;

        let leaf = workspace.getLeavesOfType(TASK_VIEW_ID)[0];
        if (!leaf) {
            leaf = workspace.getLeaf('tab');
            await leaf.setViewState({
                type: TASK_VIEW_ID,
                active: true,
            });
        }

        workspace.revealLeaf(leaf);
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        this.updateCSSVariables();
    }

    async saveSettings() {
        await this.saveData(this.settings);
        this.updateCSSVariables();
    }

    private updateCSSVariables() {
        document.documentElement.style.setProperty('--festival-solar-color', this.settings.solarFestivalColor);
        document.documentElement.style.setProperty('--festival-lunar-color', this.settings.lunarFestivalColor);
        document.documentElement.style.setProperty('--festival-solar-term-color', this.settings.solarTermColor);
    }

    refreshCalendarViews() {
        const leaves = this.app.workspace.getLeavesOfType(CALENDAR_VIEW_ID);
        leaves.forEach(leaf => {
            const view = leaf.view as unknown as CalendarView;
            if (view && view.refreshSettings) {
                view.refreshSettings();
            }
        });
    }

    refreshTaskViews() {
        const leaves = this.app.workspace.getLeavesOfType(TASK_VIEW_ID);
        leaves.forEach(leaf => {
            const view = leaf.view as unknown as TaskView;
            if (view && view.render) {
                view.render();
            }
        });
    }
}

class SampleModal extends Modal {
    constructor(app: App) {
        super(app);
    }

    onOpen() {
        const {contentEl} = this;
        contentEl.setText('Woah!');
    }

    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}
