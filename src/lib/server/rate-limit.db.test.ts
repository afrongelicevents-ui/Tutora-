import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { freshDb, hasTestDb } from './testing/db.ts';
import { clearLimit, clientIp, hitLimit, peekLimit } from './rate-limit.ts';
import type { DB } from './db/types.ts';

describe.skipIf(!hasTestDb)('rate limits (real database)', () => {
	let db: DB;
	let close: () => Promise<void>;
	beforeAll(async () => ({ db, close } = await freshDb()));
	afterAll(async () => close?.());

	it('allows up to the limit, then blocks until the window resets', async () => {
		const t0 = 1_000_000;
		const rule = { max: 3, windowSeconds: 60 };
		const results = [];
		for (let i = 0; i < 4; i++) results.push(await hitLimit(db, 'login', 'ip-1', t0 + i, rule));
		expect(results.map((r) => r.ok)).toEqual([true, true, true, false]);
		expect(results[3].retryAfterSeconds).toBe(60);
		// another person is not affected
		expect((await hitLimit(db, 'login', 'ip-2', t0, rule)).ok).toBe(true);
		// after the window it starts again
		expect((await hitLimit(db, 'login', 'ip-1', t0 + 61_000, rule)).ok).toBe(true);
	});

	it('locks an account after too many wrong passwords, and a right one clears it', async () => {
		const t0 = 2_000_000;
		const rule = { max: 3, windowSeconds: 1800 };
		expect((await peekLimit(db, 'loginFail', 'a@b.c', t0, rule)).ok).toBe(true);
		for (let i = 0; i < 3; i++) await hitLimit(db, 'loginFail', 'a@b.c', t0 + i, rule);
		const locked = await peekLimit(db, 'loginFail', 'a@b.c', t0 + 10, rule);
		expect(locked.ok).toBe(false);
		expect(locked.retryAfterSeconds).toBeGreaterThan(0);
		// another account is not affected; the lock ends with the window
		expect((await peekLimit(db, 'loginFail', 'x@y.z', t0, rule)).ok).toBe(true);
		expect((await peekLimit(db, 'loginFail', 'a@b.c', t0 + 1_801_000, rule)).ok).toBe(true);
		await clearLimit(db, 'loginFail', 'a@b.c');
		expect((await peekLimit(db, 'loginFail', 'a@b.c', t0 + 10, rule)).ok).toBe(true);
	});

	it('counts parallel requests correctly', async () => {
		const rule = { max: 5, windowSeconds: 60 };
		const rs = await Promise.all(
			Array.from({ length: 8 }, () => hitLimit(db, 'signup', 'burst', 5_000, rule))
		);
		expect(rs.filter((r) => r.ok)).toHaveLength(5);
	});

	it('reads the Cloudflare client IP header', () => {
		const req = new Request('http://x', {
			headers: { 'cf-connecting-ip': '41.1.2.3', 'x-forwarded-for': '9.9.9.9' }
		});
		expect(clientIp(req)).toBe('41.1.2.3');
	});
});
