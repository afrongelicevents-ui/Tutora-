/**
 * Zimbabwe time (Africa/Harare) is UTC+2 all year (no daylight saving),
 * so a fixed offset is exact and avoids shipping time-zone data.
 */
export const TZ_OFFSET_MIN = 120;
export const TZ = 'Africa/Harare';
const MS_MIN = 60_000;
const MS_DAY = 86_400_000;

/** Local (Zimbabwe) calendar parts of an instant. */
export function local(d: Date) {
	const x = new Date(d.getTime() + TZ_OFFSET_MIN * MS_MIN);
	return {
		year: x.getUTCFullYear(),
		month: x.getUTCMonth() + 1,
		day: x.getUTCDate(),
		weekday: x.getUTCDay(),
		minutes: x.getUTCHours() * 60 + x.getUTCMinutes()
	};
}

/** Instant for a Zimbabwe local date (YYYY-MM-DD) plus minutes after midnight. */
export function fromLocal(isoDate: string, minutes = 0): Date {
	const [y, m, d] = isoDate.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d) + (minutes - TZ_OFFSET_MIN) * MS_MIN);
}

/** "YYYY-MM-DD" (Zimbabwe date) for an instant. */
export function localDate(d: Date): string {
	const p = local(d);
	return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export function isIsoDate(v: string): boolean {
	return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(fromLocal(v).getTime());
}

/** Start of the Zimbabwe day containing d. */
export function startOfLocalDay(d: Date): Date {
	return fromLocal(localDate(d), 0);
}

export function addDays(d: Date, n: number): Date {
	return new Date(d.getTime() + n * MS_DAY);
}

export function addMinutes(d: Date, n: number): Date {
	return new Date(d.getTime() + n * MS_MIN);
}

/** Monday of the Zimbabwe week containing d (00:00 local). */
export function startOfLocalWeek(d: Date): Date {
	const day = startOfLocalDay(d);
	const wd = local(d).weekday;
	return addDays(day, -((wd + 6) % 7));
}

export function minutesToHHMM(min: number): string {
	return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

export function hhmmToMinutes(v: string): number | null {
	const t = v.trim();
	if (t === '24:00') return 1440;
	const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(t);
	return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

const fmt = (opts: Intl.DateTimeFormatOptions) =>
	new Intl.DateTimeFormat('en-GB', { timeZone: TZ, ...opts });
const F = {
	day: fmt({ weekday: 'short', day: 'numeric', month: 'short' }),
	date: fmt({ day: 'numeric', month: 'long', year: 'numeric' }),
	// "4:00 PM", as in the approved design
	time: new Intl.DateTimeFormat('en-US', {
		timeZone: TZ,
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	}),
	month: fmt({ month: 'long', year: 'numeric' }),
	weekday: fmt({ weekday: 'short' })
};
export const fmtDay = (d: Date) => F.day.format(d);
export const fmtDate = (d: Date) => F.date.format(d);
export const fmtTime = (d: Date) => F.time.format(d);
export const fmtMonth = (d: Date) => F.month.format(d);
export const fmtWeekday = (d: Date) => F.weekday.format(d);
export const fmtDayTime = (d: Date) => `${fmtDay(d)} ${fmtTime(d)}`;

/** "4:00 PM" for minutes after midnight (study plan slots, availability). */
export function fmtMinutes(min: number): string {
	const h = Math.floor(min / 60) % 24;
	const mm = String(min % 60).padStart(2, '0');
	return `${h % 12 === 0 ? 12 : h % 12}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
}
