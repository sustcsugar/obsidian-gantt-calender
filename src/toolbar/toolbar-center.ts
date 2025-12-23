import type { CalendarViewType } from '../types';
import { solarToLunar, getShortLunarText } from '../lunar/lunar';

/**
 * 工具栏中间区域 - 信息展示区
 * 负责显示日期范围、标题、农历等信息
 */
export class ToolbarCenter {
	/**
	 * 渲染中间区域
	 * @param container 中间容器元素
	 * @param currentViewType 当前视图类型
	 * @param currentDate 当前日期
	 * @param dateRangeText 日期范围文本
	 */
	render(
		container: HTMLElement,
		currentViewType: CalendarViewType,
		currentDate: Date,
		dateRangeText: string
	): void {
		container.empty();
		container.addClass('calendar-toolbar-center');

		const dateDisplay = container.createEl('span');
		dateDisplay.addClass('calendar-date-display');

		// 日视图特殊处理：显示农历和节日
		if (currentViewType === 'day') {
			const lunar = solarToLunar(currentDate);
			const lunarText = getShortLunarText(currentDate);
			let displayText = dateRangeText;
			if (lunarText) displayText += ` • ${lunarText}`;
			if (lunar.festival) displayText += ` • ${lunar.festival}`;
			dateDisplay.setText(displayText);
		} else {
			dateDisplay.setText(dateRangeText);
		}
	}
}
