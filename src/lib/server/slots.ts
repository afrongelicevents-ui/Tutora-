import { addDays, addMinutes, fromLocal, local, localDate } from '../tz.ts';

export interface Window {
	weekday: number;
	startMinute: number;
	endMinute: number;
}
export interface Busy {
	start: Date;
	end: Date;
}

export const BOOK_DAYS_AHEAD = 21;
export const MIN_LEAD_HOURS = 12;
export const INTRO_MINUTES = 15;

/**
 * Free start times a student may request: inside the tutor's weekly free times,
 * at least MIN_LEAD_HOURS from now, up to BOOK_DAYS_AHEAD days ahead,
 * and not overlapping a lesson, the tutor's own event or another pending request.
 */
export function freeSlots(opts: {
	windows: Window[];
	minutes: number;
	busy: Busy[];
	now: Date;
	days?: number;
	leadHours?: number;
}): Date[] {
	const { windows, minutes, busy, now } = opts;
	const days = opts.days ?? BOOK_DAYS_AHEAD;
	const earliest = addMinutes(now, (opts.leadHours ?? MIN_LEAD_HOURS) * 60);
	const out: Date[] = [];
	const today = localDate(now);
	for (let d = 0; d <= days; d++) {
		const date = localDate(addDays(fromLocal(today, 12 * 60), d));
		const wd = local(fromLocal(date, 12 * 60)).weekday;
		for (const w of windows.filter((x) => x.weekday === wd)) {
			for (let t = w.startMinute; t + minutes <= w.endMinute; t += minutes) {
				const start = fromLocal(date, t);
				const end = addMinutes(start, minutes);
				if (start < earliest) continue;
				if (busy.some((b) => b.start < end && b.end > start)) continue;
				out.push(start);
			}
		}
	}
	return out.sort((a, b) => a.getTime() - b.getTime());
}

/** True if `start` is one of the free slots (used to re-check a submitted time on the server). */
export function isFreeSlot(start: Date, opts: Parameters<typeof freeSlots>[0]): boolean {
	return freeSlots(opts).some((s) => s.getTime() === start.getTime());
}

export function overlaps(a: Busy, b: Busy) {
	return a.start < b.end && a.end > b.start;
}
