/**
 * Get number of days in specified month
 */
export function getDaysInMonth(year: number, month: number): number {
	return new Date(year, month, 0).getDate();
}

/**
 * Get weekday of first day of specified month (0-6, 0=Sunday)
 */
export function getFirstDayOfMonth(year: number, month: number): number {
	return new Date(year, month - 1, 1).getDay();
}

/**
 * Format date to string
 */
export function formatDate(date: Date, format: string = 'YYYY-MM-DD'): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];

	return format
		.replace('YYYY', String(year))
		.replace('MM', month)
		.replace('DD', day)
		.replace('ddd', dayName);
}

/**
 * Format month/year to string
 */
export function formatMonth(year: number, month: number): string {
	const months = ['January', 'February', 'March', 'April', 'May', 'June',
		'July', 'August', 'September', 'October', 'November', 'December'];
	return `${months[month - 1]} ${year}`;
}
