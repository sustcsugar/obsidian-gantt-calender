/**
 * Get today's date at midnight (00:00:00.000)
 */
export function getTodayDate(): Date {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	return d;
}
