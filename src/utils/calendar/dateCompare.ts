/**
 * Check if date is today
 */
export function isToday(date: Date): boolean {
	const today = new Date();
	return (
		date.getDate() === today.getDate() &&
		date.getMonth() === today.getMonth() &&
		date.getFullYear() === today.getFullYear()
	);
}

/**
 * Check if date is in current month
 */
export function isThisMonth(date: Date): boolean {
	const today = new Date();
	return (
		date.getMonth() === today.getMonth() &&
		date.getFullYear() === today.getFullYear()
	);
}
