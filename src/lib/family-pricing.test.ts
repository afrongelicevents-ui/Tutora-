import { describe, expect, it } from 'vitest';
import { childMonthlyCents, dollars, monthlyCents, quote } from './family-pricing';

const none = { discount3mPct: 0, discount6mPct: 0 };

describe('Tutora Family pricing', () => {
	it('charges 12, then 8, 8, then 10 per child', () => {
		expect([0, 1, 2, 3, 4].map(childMonthlyCents)).toEqual([1200, 800, 800, 1000, 1000]);
		expect([1, 2, 3, 4, 5].map(monthlyCents)).toEqual([1200, 2000, 2800, 3800, 4800]);
	});
	it('multiplies by the period, no discount by default', () => {
		expect(quote(2, 3, none).totalCents).toBe(6000);
		expect(quote(4, 6, none).totalCents).toBe(22800);
		expect(quote(1, 7, none).period).toBe(1);
	});
	it('applies the owner discount for 3 and 6 months only', () => {
		const d = { discount3mPct: 10, discount6mPct: 15 };
		expect(quote(1, 1, d).totalCents).toBe(1200);
		expect(quote(1, 3, d).totalCents).toBe(3240);
		const q = quote(3, 6, d);
		expect(q.discountPct).toBe(15);
		expect(q.grossCents).toBe(16800);
		expect(q.totalCents).toBe(14280);
		expect(q.perChildCents.reduce((a, b) => a + b, 0)).toBe(q.totalCents);
	});
	it('formats dollars', () => {
		expect(dollars(1200)).toBe('$12');
		expect(dollars(3240)).toBe('$32.40');
	});
});

import { familyFeatureFor, lockedLocation } from './family-features';

describe('Tutora Family features', () => {
	it('locks the Family pages only', () => {
		expect(familyFeatureFor('/student/planner')).toBe('planner');
		expect(familyFeatureFor('/student/messages/test_chipo')).toBe('messages');
		expect(familyFeatureFor('/student/messages/__data.json')).toBe('messages');
		expect(familyFeatureFor('/student/book')).toBeNull();
		expect(familyFeatureFor('/student/payments')).toBeNull();
		expect(familyFeatureFor('/student/plannerx')).toBeNull();
		expect(familyFeatureFor('/parent/progress')).toBe('progress');
		expect(familyFeatureFor('/parent/payments')).toBeNull();
		expect(familyFeatureFor('/parent/child/test_tatenda/reports/3/pdf')).toBe('report');
		expect(familyFeatureFor('/parent/child/test_tatenda')).toBeNull();
		expect(familyFeatureFor('/student/quiz/5')).toBe('tests');
		expect(lockedLocation('/parent/report', 'report')).toBe('/parent/plans?locked=report');
		expect(lockedLocation('/student/check', 'check')).toBe('/student/upgrade?locked=check');
	});
});

describe('per-term prices', () => {
	it('charges $25 for the first child and 10% less for each other child', async () => {
		const { termQuote, childTermCents } = await import('./family-pricing');
		expect(childTermCents(0)).toBe(2500);
		expect(childTermCents(1)).toBe(2250);
		expect(termQuote(1).totalCents).toBe(2500);
		expect(termQuote(3).totalCents).toBe(7000);
	});
	it('charges only the rest of the term when joining mid-term', async () => {
		const { termQuote } = await import('./family-pricing');
		const q = termQuote(2, 0.5);
		expect(q.perChildCents).toEqual([1250, 1150]);
		expect(q.totalCents).toBe(2400);
		expect(q.fullCents).toBe(4750);
	});
});
