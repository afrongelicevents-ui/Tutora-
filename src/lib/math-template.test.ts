import { describe, expect, it } from 'vitest';
import {
	cleanTemplate,
	evaluate,
	instantiate,
	numberMatches,
	parseFormula,
	readNumber,
	TemplateFail
} from './math-template.ts';

describe('maths templates: the safe calculator', () => {
	it('works out + - * / ^ and brackets in the usual order', () => {
		const v = (s: string, vals = {}) => evaluate(parseFormula(s), vals);
		expect(v('1 + 2 * 3')).toBe(7);
		expect(v('(1 + 2) * 3')).toBe(9);
		expect(v('2 ^ 3 ^ 2')).toBe(512);
		expect(v('-2 ^ 2')).toBe(-4);
		expect(v('2 ^ -1')).toBe(0.5);
		expect(v('10 / 4')).toBe(2.5);
		expect(v('(c - b) / a', { a: 2, b: 3, c: 11 })).toBe(4);
	});

	it('refuses anything that is not plain arithmetic', () => {
		for (const bad of [
			'constructor',
			'a.constructor',
			'alert(1)',
			'process.exit()',
			'a; b',
			'a = 1',
			'`x`',
			'1 +',
			'(1',
			'1)',
			'Math.max(1,2)',
			'a[0]',
			'"1"',
			'',
			'1'.repeat(300)
		]) {
			let threw = false;
			try {
				evaluate(parseFormula(bad), { a: 1, b: 2, constructor: 3 });
			} catch (e) {
				threw = e instanceof TemplateFail;
			}
			expect(threw, bad).toBe(true);
		}
		// unknown names and division by zero are refused too
		expect(() => evaluate(parseFormula('x + 1'), {})).toThrow(TemplateFail);
		expect(() => evaluate(parseFormula('1 / (a - a)'), { a: 3 })).toThrow(TemplateFail);
		expect(() => evaluate(parseFormula('2 ^ 50'), {})).toThrow(TemplateFail);
	});

	it('gives each student their own numbers and a clean, worked-out answer', () => {
		const t = {
			vars: { a: { min: 2, max: 9 }, x: { min: -5, max: 10 }, b: { min: 1, max: 20 } },
			lets: { c: 'a * x + b' },
			answer: 'x'
		};
		const prompt = 'Solve {a}x + {b} = {c}';
		const clean = cleanTemplate(t, prompt);
		const one = instantiate(clean, prompt, 1);
		const again = instantiate(clean, prompt, 1);
		expect(one).toEqual(again); // the same student always sees the same numbers
		const { a, b, c } = one.values;
		expect(one.prompt).toBe(`Solve ${a}x + ${b} = ${c}`);
		expect(a * one.answer + b).toBe(c);
		const seen = new Set(
			Array.from({ length: 20 }, (_, i) => instantiate(clean, prompt, i + 7).prompt)
		);
		expect(seen.size).toBeGreaterThan(5);
	});

	it('keeps trying numbers until the answer is a whole number (or to the decimals asked)', () => {
		const t = { vars: { a: { min: 1, max: 9 }, b: { min: 1, max: 9 } }, answer: 'a / b' };
		for (let s = 0; s < 30; s++)
			expect(Number.isInteger(instantiate(t, '{a} ÷ {b}', s).answer)).toBe(true);
		const d = instantiate({ ...t, decimals: 1 }, '{a} ÷ {b}', 3);
		expect(Math.round(d.answer * 10) / 10).toBe(d.answer);
	});

	it('refuses templates that cannot work', () => {
		expect(() => cleanTemplate({ vars: {}, answer: '1' }, 'x')).toThrow(TemplateFail);
		expect(() => cleanTemplate({ vars: { a: { min: 5, max: 1 } }, answer: 'a' }, '{a}')).toThrow(
			TemplateFail
		);
		expect(() => cleanTemplate({ vars: { a: { min: 1, max: 5 } }, answer: 'b' }, '{a}')).toThrow(
			TemplateFail
		);
		expect(() => cleanTemplate({ vars: { a: { min: 1, max: 5 } }, answer: 'a' }, '{z}')).toThrow(
			TemplateFail
		);
		// never a clean answer: 1 / 3 with a fixed 3
		expect(() =>
			cleanTemplate({ vars: { a: { min: 1, max: 1 } }, answer: 'a / 3' }, '{a} / 3')
		).toThrow(TemplateFail);
	});

	it('reads typed numbers and marks them', () => {
		expect(readNumber(' -3 ')).toBe(-3);
		expect(readNumber('2,5')).toBe(2.5);
		expect(readNumber('7/2')).toBe(3.5);
		expect(readNumber('three')).toBeNull();
		expect(numberMatches('4', 4, 0)).toBe(true);
		expect(numberMatches('4.0', 4, 0)).toBe(true);
		expect(numberMatches('4.4', 4, 0)).toBe(false);
		expect(numberMatches('2.33', 2.33, 2)).toBe(true);
		expect(numberMatches('2.3', 2.33, 2)).toBe(false);
		expect(numberMatches('', 0, 0)).toBe(false);
	});
});
