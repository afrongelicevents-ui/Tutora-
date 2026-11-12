import { describe, expect, it } from 'vitest';
import { shortName } from './names.ts';

describe('shortName', () => {
	it('uses title and surname, or the first name', () => {
		expect(shortName('Mrs Memory Sibanda')).toBe('Mrs Sibanda');
		expect(shortName('Mr. Banda')).toBe('Mr. Banda');
		expect(shortName('Tatenda Sibanda')).toBe('Tatenda');
		expect(shortName('  ')).toBe('');
	});
});
