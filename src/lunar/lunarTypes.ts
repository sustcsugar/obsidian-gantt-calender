// lunarTypes.ts
export interface LunarDate {
	lunarYear: number;
	lunarMonth: number;
	lunarDay: number;
	isLeapMonth: boolean;
	lunarMonthName: string;
	lunarDayName: string;
	ganzhiYear: string;
	animal: string;
	solarTerm: string;
	festival: string;
	festivalType?: 'solar' | 'lunar' | 'solarTerm';
}
