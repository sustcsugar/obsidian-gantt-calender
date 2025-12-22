// festival.ts
// 节日相关函数
import { solarToLunar } from './lunarConvert';

// 公历节日
const solarFestivals: { [key: string]: string } = {
	'1-1': '元旦', '2-14': '情人节', '3-8': '妇女节', '3-12': '植树节',
	'4-1': '愚人节', '5-1': '劳动节', '5-4': '青年节', '6-1': '儿童节',
	'7-1': '建党节', '8-1': '建军节', '9-10': '教师节', '10-1': '国庆节', '12-25': '圣诞节',
};
// 农历节日
const lunarFestivals: { [key: string]: string } = {
	'1-1': '春节', '1-15': '元宵节', '2-2': '龙抬头', '5-5': '端午节',
	'7-7': '七夕节', '7-15': '中元节', '8-15': '中秋节', '9-9': '重阳节',
	'12-8': '腊八节', '12-23': '小年',
};

export function getFestival(date: Date, lunarMonth: number, lunarDay: number, isLeapMonth: boolean): { name: string; type?: 'solar' | 'lunar' | 'solarTerm' } {
	const month = date.getMonth() + 1;
	const day = date.getDate();
	const solarKey = `${month}-${day}`;
	if (solarFestivals[solarKey]) {
		return { name: solarFestivals[solarKey], type: 'solar' };
	}
	if (!isLeapMonth) {
		const lunarKey = `${lunarMonth}-${lunarDay}`;
		if (lunarFestivals[lunarKey]) {
			return { name: lunarFestivals[lunarKey], type: 'lunar' };
		}
	}
	// 除夕特殊处理（腊月最后一天）
	if (lunarMonth === 12 && lunarDay === 29) {
		const nextDay = new Date(date);
		nextDay.setDate(date.getDate() + 1);
		const nextLunar = solarToLunar(nextDay);
		if (nextLunar.lunarMonth === 1 && nextLunar.lunarDay === 1) {
			return { name: '除夕', type: 'lunar' };
		}
	}
	if (lunarMonth === 12 && lunarDay === 30) {
		return { name: '除夕', type: 'lunar' };
	}
	return { name: '' };
}
