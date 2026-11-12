import { fmtMinutes } from './tz.ts';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const short = (min: number) => fmtMinutes(min).replace(':00', '');

/**
 * "Mon–Fri, 4–8 PM · Sat, 9 AM–12 PM" from weekly free times (Monday first).
 * Days with the same hours are grouped; runs of 3+ days become a range.
 */
export function availabilitySummary(
	times: { weekday: number; startMinute: number; endMinute: number }[]
): string {
	if (!times.length) return '';
	const order = [1, 2, 3, 4, 5, 6, 0];
	const hoursOf = (d: number) =>
		times
			.filter((t) => t.weekday === d)
			.sort((a, b) => a.startMinute - b.startMinute)
			.map((t) => {
				const a = short(t.startMinute);
				const b = short(t.endMinute);
				// "4–8 PM" when both are PM (or both AM)
				const sameHalf = a.slice(-2) === b.slice(-2);
				return sameHalf ? `${a.slice(0, -3)}–${b}` : `${a}–${b}`;
			})
			.join(', ');
	const groups: { days: number[]; hours: string }[] = [];
	for (const d of order) {
		const h = hoursOf(d);
		if (!h) continue;
		const g = groups.find((x) => x.hours === h);
		if (g) g.days.push(d);
		else groups.push({ days: [d], hours: h });
	}
	const dayList = (days: number[]) => {
		const idx = days.map((d) => order.indexOf(d));
		const consecutive = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
		if (days.length >= 3 && consecutive) return `${DAYS[days[0]]}–${DAYS[days.at(-1)!]}`;
		return days.map((d) => DAYS[d]).join(', ');
	};
	return groups.map((g) => `${dayList(g.days)}, ${g.hours}`).join(' · ');
}
