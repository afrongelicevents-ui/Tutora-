import { describe, expect, it } from 'vitest';
import { formatMoney, parseMoney } from './money.ts';
import { toCsv, receiptNumber } from './server/billing.ts';

describe('money is whole cents', () => {
	it('parses what people type', () => {
		expect(parseMoney('8')).toBe(800);
		expect(parseMoney('8.5')).toBe(850);
		expect(parseMoney('$12.50')).toBe(1250);
		expect(parseMoney('ZiG 1,200')).toBe(120000);
		expect(parseMoney('0.1')).toBe(10);
		expect(parseMoney('1.234')).toBeNull();
		expect(parseMoney('-5')).toBeNull();
		expect(parseMoney('abc')).toBeNull();
		expect(parseMoney('')).toBeNull();
	});
	it('formats USD and ZiG', () => {
		expect(formatMoney(2800)).toBe('$28.00');
		expect(formatMoney(5, 'ZWG')).toBe('ZiG 0.05');
	});
	it('receipt numbers', () => {
		expect(receiptNumber(15)).toBe('R-000015');
	});
});

describe('CSV export', () => {
	it('quotes cells and blocks spreadsheet formulas', () => {
		const csv = toCsv([
			['Name', 'Amount'],
			['=HYPERLINK("http://evil")', 12.5],
			['Moyo, Rudo', null],
			['Say "hi"', '-1+1']
		]);
		expect(csv).toBe(
			'Name,Amount\r\n"\'=HYPERLINK(""http://evil"")",12.5\r\n"Moyo, Rudo",\r\n"Say ""hi""",\'-1+1\r\n'
		);
	});
});
