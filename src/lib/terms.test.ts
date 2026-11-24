import { describe, expect, it } from 'vitest';
import { billTerm, cleanTerms, harareDate, parseTermLines, termLines } from './terms';

const terms = [
	{ name: 'Term 1', start: '2027-01-12', end: '2027-04-09' },
	{ name: 'Term 2', start: '2027-05-04', end: '2027-08-06' }
];

describe('school terms', () => {
	it('bills the whole term when paying before it starts', () => {
		const t = billTerm(terms, harareDate('2027-01-02'));
		expect(t.name).toBe('Term 1');
		expect(t.fraction).toBe(1);
		// covers the holiday after it, up to the next term
		expect(t.coversUntil.getTime()).toBe(harareDate('2027-05-04').getTime());
	});

	it('bills only the rest of the term when joining mid-term', () => {
		const t = billTerm(terms, harareDate('2027-02-25'));
		expect(t.name).toBe('Term 1');
		expect(t.fraction).toBeGreaterThan(0.4);
		expect(t.fraction).toBeLessThan(0.6);
	});

	it('bills the next term during the holiday', () => {
		const t = billTerm(terms, harareDate('2027-04-20'));
		expect(t.name).toBe('Term 2');
		expect(t.fraction).toBe(1);
	});

	it('falls back to 3 months when no term dates are left', () => {
		const t = billTerm(terms, harareDate('2027-09-01'));
		expect(t.name).toBe('');
		expect(t.fraction).toBe(1);
	});

	it('reads and writes the owner text, dropping bad lines', () => {
		const text = 'Term 2, 2027-05-04, 2027-08-06\nnonsense\nTerm 1, 2027-01-12, 2027-04-09';
		const parsed = parseTermLines(text);
		expect(parsed.map((t) => t.name)).toEqual(['Term 1', 'Term 2']);
		expect(parseTermLines(termLines(parsed))).toEqual(parsed);
		expect(cleanTerms([{ name: 'x', start: '2027-02-01', end: '2027-01-01' }])).toEqual([]);
	});
});
