import { GanttTask } from '../types';

export function dateValue(d?: Date): number | undefined {
	return d ? d.getTime() : undefined;
}

export function areTasksEqual(a: GanttTask[], b: GanttTask[]): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		const ta = a[i];
		const tb = b[i];
		if (ta.filePath !== tb.filePath) return false;
		if (ta.lineNumber !== tb.lineNumber) return false;
		if (ta.content !== tb.content) return false;
		if (ta.completed !== tb.completed) return false;
		if ((ta.priority || '') !== (tb.priority || '')) return false;
		if ((ta.format || '') !== (tb.format || '')) return false;
		if (dateValue(ta.createdDate) !== dateValue(tb.createdDate)) return false;
		if (dateValue(ta.startDate) !== dateValue(tb.startDate)) return false;
		if (dateValue(ta.scheduledDate) !== dateValue(tb.scheduledDate)) return false;
		if (dateValue(ta.dueDate) !== dateValue(tb.dueDate)) return false;
		if (dateValue(ta.cancelledDate) !== dateValue(tb.cancelledDate)) return false;
		if (dateValue(ta.completionDate) !== dateValue(tb.completionDate)) return false;
	}
	return true;
}
