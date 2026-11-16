import { describe, expect, it } from 'vitest';
import {
	cleanDueTime,
	dueAt,
	handedInLate,
	isOverdueForMissing,
	MISSING_AFTER_H,
	suggestedMark
} from './homework-status.ts';
import { countHomework, cleanPeriod, lastMonth, ReportFail } from './reports.ts';
import { fromLocal } from '../tz.ts';

describe('homework due time, late and missing', () => {
	it('due date + time is Zimbabwe time; no time = end of that day', () => {
		expect(dueAt('2026-11-20', '18:00')!.toISOString()).toBe('2026-11-20T16:00:00.000Z');
		expect(dueAt('2026-11-20', null)!.toISOString()).toBe('2026-11-20T21:59:00.000Z');
		expect(dueAt(null, '18:00')).toBeNull();
	});
	it('cleans the time', () => {
		expect(cleanDueTime('09:30')).toBe('09:30');
		expect(cleanDueTime('9:30')).toBeNull();
		expect(cleanDueTime('24:00')).toBeNull();
		expect(cleanDueTime('')).toBeNull();
		expect(cleanDueTime(undefined)).toBeNull();
	});
	it('late only after the due minute', () => {
		const due = fromLocal('2026-11-20', 18 * 60);
		expect(handedInLate(new Date(due.getTime() - 60_000), '2026-11-20', '18:00')).toBe(false);
		expect(handedInLate(new Date(due.getTime() + 30_000), '2026-11-20', '18:00')).toBe(false);
		expect(handedInLate(new Date(due.getTime() + 60_000), '2026-11-20', '18:00')).toBe(true);
		expect(handedInLate(new Date(), null, null)).toBe(false);
	});
	it('suggests done, late or missing', () => {
		const due = fromLocal('2026-11-20', 18 * 60);
		expect(suggestedMark(new Date(due.getTime() - 1), '2026-11-20', '18:00')).toBe('done');
		expect(suggestedMark(new Date(due.getTime() + 3_600_000), '2026-11-20', '18:00')).toBe('late');
		expect(suggestedMark(null, '2026-11-20', '18:00')).toBe('missing');
	});
	it('missing only a full grace period after the due time', () => {
		const due = fromLocal('2026-11-20', 18 * 60);
		const h = MISSING_AFTER_H * 3_600_000;
		expect(isOverdueForMissing('2026-11-20', '18:00', new Date(due.getTime() + h - 1))).toBe(false);
		expect(isOverdueForMissing('2026-11-20', '18:00', new Date(due.getTime() + h))).toBe(true);
		expect(isOverdueForMissing(null, null, new Date('2030-01-01'))).toBe(false);
	});
});

describe('report helpers', () => {
	it('counts homework: a mark wins, then handed in, then overdue = missing', () => {
		expect(
			countHomework([
				{ mark: 'late', handedIn: true, overdue: true },
				{ mark: null, handedIn: true, overdue: false },
				{ mark: null, handedIn: false, overdue: true },
				{ mark: null, handedIn: false, overdue: false },
				{ mark: 'missing', handedIn: false, overdue: true }
			])
		).toEqual({ set: 5, done: 1, late: 1, missing: 2, waiting: 1 });
	});
	it('periods: ordered, checked, at most 120 days', () => {
		expect(cleanPeriod('2026-10-31', '2026-10-01')).toEqual({
			from: '2026-10-01',
			to: '2026-10-31'
		});
		expect(() => cleanPeriod('2026-01-01', '2026-12-31')).toThrow(ReportFail);
		expect(() => cleanPeriod('nope', '2026-12-31')).toThrow('rp_err_dates');
	});
	it('last month', () => {
		expect(lastMonth(new Date('2026-11-16T08:00:00Z'))).toEqual({
			from: '2026-10-01',
			to: '2026-10-31'
		});
		expect(lastMonth(new Date('2026-01-05T08:00:00Z'))).toEqual({
			from: '2025-12-01',
			to: '2025-12-31'
		});
		expect(lastMonth(new Date('2028-03-02T08:00:00Z'))).toEqual({
			from: '2028-02-01',
			to: '2028-02-29'
		});
	});
});
