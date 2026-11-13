import { describe, expect, it } from 'vitest';
import { hashPassword as oldHash } from 'better-auth/crypto';
import { hashPassword, isOldHash, verifyPassword } from './password.ts';

describe('password hashing', () => {
	it('checks a new hash, and only with the right password', async () => {
		const h = await hashPassword('Shot-pass-123');
		expect(isOldHash(h)).toBe(false);
		expect(await verifyPassword({ hash: h, password: 'Shot-pass-123' })).toBe(true);
		expect(await verifyPassword({ hash: h, password: 'Shot-pass-124' })).toBe(false);
	});

	it('still accepts an old (scrypt) hash so nobody is locked out', async () => {
		const h = await oldHash('Shot-pass-123');
		expect(isOldHash(h)).toBe(true);
		expect(await verifyPassword({ hash: h, password: 'Shot-pass-123' })).toBe(true);
	});

	it('refuses a broken or over-sized hash', async () => {
		expect(await verifyPassword({ hash: 'pbkdf2$999999999$AA==$AA==', password: 'x' })).toBe(false);
		expect(await verifyPassword({ hash: 'pbkdf2$100000$!!$!!', password: 'x' })).toBe(false);
	});
});
