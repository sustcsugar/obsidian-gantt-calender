// lunarUtils.ts
import { lunarYearData } from './lunarData';

// 获取某年的农历信息
export function getLunarYearData(year: number): number {
	return lunarYearData[year - 1900];
}
// 获取某年闰月月份（0表示无闰月）
export function getLeapMonth(year: number): number {
	return getLunarYearData(year) & 0xf;
}
// 获取某年闰月天数
export function getLeapDays(year: number): number {
	if (getLeapMonth(year)) {
		return (getLunarYearData(year) & 0x10000) ? 30 : 29;
	}
	return 0;
}
// 获取某年某月的天数
export function getMonthDays(year: number, month: number): number {
	return (getLunarYearData(year) & (0x10000 >> month)) ? 30 : 29;
}
// 获取某年的总天数
export function getYearDays(year: number): number {
	let sum = 348;
	for (let i = 0x8000; i > 0x8; i >>= 1) {
		sum += (getLunarYearData(year) & i) ? 1 : 0;
	}
	return sum + getLeapDays(year);
}
