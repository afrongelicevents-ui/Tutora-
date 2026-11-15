import { describe, expect, it } from 'vitest';
import { initialOf, shortName } from './names.ts';

describe('shortName', () => {
	it('uses title and surname, or the first name', () => {
		expect(shortName('Mrs Memory Sibanda')).toBe('Mrs Sibanda');
		expect(shortName('Mr. Banda')).toBe('Mr. Banda');
		expect(shortName('Tatenda Sibanda')).toBe('Tatenda');
		expect(shortName('  ')).toBe('');
	});
});

describe('initialOf', () => {
	it('takes the first name, skipping titles', () => {
		expect(initialOf('Mrs Sibanda')).toBe('S');
		expect(initialOf('Dr. Tendai Moyo')).toBe('T');
		expect(initialOf('rudo moyo')).toBe('R');
		expect(initialOf('  ')).toBe('?');
	});
});
