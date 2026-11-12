import { describe, expect, it } from 'vitest';
import { freeSlots } from './slots.ts';
import { fmtTime, fromLocal, local, localDate, startOfLocalWeek } from '../tz.ts';
import { MONDAY_8AM, zw } from './testing/fixtures.ts';

const weekdays = (from: string, to: string) =>
	[1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMinute: toMin(from), endMinute: toMin(to) }));
const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));

describe('Zimbabwe time helpers', () => {
	it('uses UTC+2 all year', () => {
		const d = fromLocal('2026-06-01', 15 * 60);
		expect(d.toISOString()).toBe('2026-06-01T13:00:00.000Z');
		expect(local(d).minutes).toBe(15 * 60);
		expect(fmtTime(d)).toBe('3:00 PM');
		expect(localDate(new Date('2026-06-01T22:30:00Z'))).toBe('2026-06-02');
	});
	it('finds the Monday of the week', () => {
		expect(localDate(startOfLocalWeek(zw(3, '10:00')))).toBe('2026-11-16');
		expect(localDate(startOfLocalWeek(zw(6, '23:00')))).toBe('2026-11-16');
	});
});

describe('free booking times', () => {
	const base = {
		windows: weekdays('15:00', '18:00'),
		minutes: 60,
		busy: [],
		now: MONDAY_8AM,
		days: 7
	};

	it('offers times inside the weekly free times only, in lesson-length steps', () => {
		const slots = freeSlots(base);
		// Mon is too soon (12 h notice from 08:00 means after 20:00), so Tue-Fri, plus next Mon
		expect(slots.map((s) => localDate(s) + ' ' + fmtTime(s)).slice(0, 4)).toEqual([
			'2026-11-17 3:00 PM',
			'2026-11-17 4:00 PM',
			'2026-11-17 5:00 PM',
			'2026-11-18 3:00 PM'
		]);
		expect(slots.every((s) => local(s).minutes >= 900 && local(s).minutes <= 1020)).toBe(true);
		expect(slots).toHaveLength(15);
	});

	it('needs at least 12 hours notice', () => {
		const slots = freeSlots({ ...base, now: zw(1, '04:00') });
		expect(fmtTime(slots[0])).toBe('4:00 PM'); // Tue 15:00 is only 11 h away
	});

	it('skips times that overlap a lesson, an own event or a pending request', () => {
		const busy = [{ start: zw(1, '15:30'), end: zw(1, '16:30') }];
		const tue = freeSlots({ ...base, busy }).filter((s) => localDate(s) === '2026-11-17');
		expect(tue.map(fmtTime)).toEqual(['5:00 PM']);
	});

	it('fits shorter intro chats into the same windows', () => {
		const slots = freeSlots({ ...base, minutes: 15 }).filter((s) => localDate(s) === '2026-11-17');
		expect(slots).toHaveLength(12);
	});

	it('offers nothing when no free times are set', () => {
		expect(freeSlots({ ...base, windows: [] })).toEqual([]);
	});
});
