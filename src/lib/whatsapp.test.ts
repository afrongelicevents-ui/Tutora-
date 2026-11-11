import { describe, expect, it } from 'vitest';
import { formatZwPhone, waDigits, waLink } from './whatsapp.ts';

describe('whatsapp links', () => {
	it('uses only digits in wa.me links', () => {
		expect(waDigits('+263 77 000 0001')).toBe('263770000001');
		expect(waLink('+263770000001')).toBe('https://wa.me/263770000001');
	});
	it('encodes prefilled text', () => {
		expect(waLink('+263770000001', "Hi, I'd like a lesson & info")).toBe(
			"https://wa.me/263770000001?text=Hi%2C%20I'd%20like%20a%20lesson%20%26%20info"
		);
	});
	it('formats Zimbabwe numbers for display', () => {
		expect(formatZwPhone('+263770000001')).toBe('+263 77 000 0001');
		expect(formatZwPhone('+44 20 7946 0000')).toBe('+44 20 7946 0000');
	});
});
