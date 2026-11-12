import { describe, expect, it } from 'vitest';
import { availabilitySummary } from './availability.ts';

describe('availability summary', () => {
	it('groups weekdays with the same hours', () => {
		const t = [1, 2, 3, 4, 5].map((weekday) => ({
			weekday,
			startMinute: 16 * 60,
			endMinute: 20 * 60
		}));
		expect(availabilitySummary(t)).toBe('Mon–Fri, 4–8 PM');
		expect(
			availabilitySummary([...t, { weekday: 6, startMinute: 9 * 60, endMinute: 12 * 60 }])
		).toBe('Mon–Fri, 4–8 PM · Sat, 9 AM–12 PM');
		expect(availabilitySummary([])).toBe('');
	});
});
