import { App, PluginSettingTab, Setting } from 'obsidian';
import type GanttCalendarPlugin from '../main';

// Gantt Calendar Plugin Settings Interface
export interface GanttCalendarSettings {
	mySetting: string;
	yearViewRowGap: number;
	yearViewColumnGap: number;
	startOnMonday: boolean;
	yearLunarFontSize: number;
}

export const DEFAULT_SETTINGS: GanttCalendarSettings = {
	mySetting: 'default',
	yearViewRowGap: 0,
	yearViewColumnGap: 0,
	startOnMonday: true,
	yearLunarFontSize: 10,
};

export class GanttCalendarSettingTab extends PluginSettingTab {
	plugin: GanttCalendarPlugin;

	constructor(app: App, plugin: GanttCalendarPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: '年视图设置' });

		new Setting(containerEl)
			.setName('日期行间距')
			.setDesc('调整年视图中日期之间的垂直间距（0-30像素）')
			.addSlider(slider => slider
				.setLimits(0, 30, 1)
				.setValue(this.plugin.settings.yearViewRowGap)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.yearViewRowGap = value;
					await this.plugin.saveSettings();
					this.plugin.refreshCalendarViews();
				}));

		new Setting(containerEl)
			.setName('日期列间距')
			.setDesc('调整年视图中日期之间的水平间距（0-30像素）')
			.addSlider(slider => slider
				.setLimits(0, 30, 1)
				.setValue(this.plugin.settings.yearViewColumnGap)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.yearViewColumnGap = value;
					await this.plugin.saveSettings();
					this.plugin.refreshCalendarViews();
				}));

		new Setting(containerEl)
			.setName('年视图农历字号')
			.setDesc('调整年视图月卡片内农历文字大小（8-18px）')
			.addSlider(slider => slider
				.setLimits(8, 18, 1)
				.setValue(this.plugin.settings.yearLunarFontSize)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.yearLunarFontSize = value;
					await this.plugin.saveSettings();
					this.plugin.refreshCalendarViews();
				}));

		containerEl.createEl('h2', { text: '通用设置' });

		new Setting(containerEl)
			.setName('一周开始于:')
			.setDesc('选择一周的起始日')
			.addDropdown(drop => {
				drop.addOptions({ 'monday': '周一', 'sunday': '周日' });
				drop.setValue(this.plugin.settings.startOnMonday ? 'monday' : 'sunday');
				drop.onChange(async (value) => {
					this.plugin.settings.startOnMonday = (value === 'monday');
					await this.plugin.saveSettings();
					this.plugin.refreshCalendarViews();
				});
			});
	}
}
