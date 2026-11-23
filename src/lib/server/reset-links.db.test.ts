import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshDb, hasTestDb, testAuth } from './testing/db.ts';
import { signUp } from './actions/signup.ts';
import { logIn } from './actions/login.ts';
import { session, user } from './db/schema.ts';
import { passwordResetLink } from './db/reset.schema.ts';
import { auditLog } from './db/app.schema.ts';
import {
	createResetLink,
	hashToken,
	readResetLink,
	ResetLinkFail,
	useResetLink,
	waNumber
} from './reset-links.ts';
import { hitLimit, peekLimit } from './rate-limit.ts';
import type { DB } from './db/types.ts';

const PW = 'correct-horse-1';
const NEW_PW = 'brand-new-pass-2';

describe('waNumber', () => {
	it('turns what people type into a WhatsApp number', () => {
		expect(waNumber('+263 77 123 4567')).toBe('263771234567');
		expect(waNumber('0771234567')).toBe('263771234567');
		expect(waNumber('12')).toBeNull();
		expect(waNumber(null)).toBeNull();
	});
});

describe.skipIf(!hasTestDb)('one-time password reset links (real database)', () => {
	let db: DB;
	let close: () => Promise<void>;
	let auth: ReturnType<typeof testAuth>['auth'];
	let ownerId: string;
	let rudoId: string;
	const hashPassword = async (pw: string) => (await auth.$context).password.hash(pw);

	beforeAll(async () => {
		({ db, close } = await freshDb());
		({ auth } = testAuth(db, { emailEnabled: false }));
		for (const [name, email] of [
			['Boss', 'boss@example.com'],
			['Rudo Moyo', 'rudo@example.com']
		]) {
			const r = await signUp(
				{ auth, db },
				{ name, email, password: PW, consent: 'on', phone: '0771234567', accountType: 'student' }
			);
			expect(r.ok).toBe(true);
		}
		const [boss] = await db.select().from(user).where(eq(user.email, 'boss@example.com'));
		await db.update(user).set({ role: 'owner' }).where(eq(user.id, boss.id));
		ownerId = boss.id;
		rudoId = (await db.select().from(user).where(eq(user.email, 'rudo@example.com')))[0].id;
	});
	afterAll(async () => close?.());

	it('keeps only a hash of the link, logs it, and finds the phone for WhatsApp', async () => {
		const r = await createResetLink(db, ownerId, rudoId);
		expect(r.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
		expect(r.name).toBe('Rudo Moyo');
		expect(r.phone).toBe('263771234567');
		const rows = await db
			.select()
			.from(passwordResetLink)
			.where(eq(passwordResetLink.userId, rudoId));
		expect(rows).toHaveLength(1);
		expect(rows[0].tokenHash).toBe(await hashToken(r.token));
		expect(JSON.stringify(rows)).not.toContain(r.token);
		const hoursLeft = (rows[0].expiresAt.getTime() - Date.now()) / 3600_000;
		expect(hoursLeft).toBeGreaterThan(23.9);
		expect(hoursLeft).toBeLessThanOrEqual(24);
		const logged = await db.select().from(auditLog).where(eq(auditLog.target, rudoId));
		expect(logged.map((l) => l.action)).toContain('reset_link_made');
		expect(JSON.stringify(logged)).not.toContain(r.token);
	});

	it('is not for the owner themselves', async () => {
		await expect(createResetLink(db, ownerId, ownerId)).rejects.toBeInstanceOf(ResetLinkFail);
	});

	it('works once: new password, other sessions out, lockout and change flag cleared', async () => {
		const r = await createResetLink(db, ownerId, rudoId);
		// a logged-in session, a wrong-password lockout and the "change your password" flag
		expect(
			(await logIn({ auth }, { email: 'rudo@example.com', password: PW }, new Headers())).ok
		).toBe(true);
		expect(await db.select().from(session).where(eq(session.userId, rudoId))).not.toHaveLength(0);
		for (let i = 0; i < 10; i++) await hitLimit(db, 'loginFail', 'rudo@example.com');
		expect((await peekLimit(db, 'loginFail', 'rudo@example.com')).ok).toBe(false);
		await db.update(user).set({ mustChangePassword: true }).where(eq(user.id, rudoId));

		expect(await readResetLink(db, r.token)).toMatchObject({ ok: true, name: 'Rudo Moyo' });
		expect((await useResetLink({ db, hashPassword }, r.token, NEW_PW)).ok).toBe(true);

		expect(await db.select().from(session).where(eq(session.userId, rudoId))).toHaveLength(0);
		expect((await peekLimit(db, 'loginFail', 'rudo@example.com')).ok).toBe(true);
		const [u] = await db.select().from(user).where(eq(user.id, rudoId));
		expect(u.mustChangePassword).toBe(false);
		expect(
			(await logIn({ auth }, { email: 'rudo@example.com', password: PW }, new Headers())).ok
		).toBe(false);
		expect(
			(await logIn({ auth }, { email: 'rudo@example.com', password: NEW_PW }, new Headers())).ok
		).toBe(true);

		// a second use fails, and reading it says so
		expect(await useResetLink({ db, hashPassword }, r.token, 'another-pass-3')).toEqual({
			ok: false,
			reason: 'gone'
		});
		expect(await readResetLink(db, r.token)).toEqual({ ok: false, reason: 'gone' });
		const logged = await db.select().from(auditLog).where(eq(auditLog.target, rudoId));
		expect(logged.map((l) => l.action)).toContain('reset_link_used');
	});

	it('stops working after 24 hours, and a newer link replaces an older one', async () => {
		const t0 = new Date();
		const old = await createResetLink(db, ownerId, rudoId, t0);
		const later = new Date(t0.getTime() + 24 * 3600_000 + 1000);
		expect(await readResetLink(db, old.token, later)).toEqual({ ok: false, reason: 'gone' });
		expect((await useResetLink({ db, hashPassword }, old.token, NEW_PW, later)).ok).toBe(false);

		const a = await createResetLink(db, ownerId, rudoId);
		const b = await createResetLink(db, ownerId, rudoId);
		expect((await readResetLink(db, a.token)).ok).toBe(false);
		expect((await readResetLink(db, b.token)).ok).toBe(true);
		expect((await readResetLink(db, 'not-a-real-link')).ok).toBe(false);
	});

	it('limits how many links one owner can make in an hour', async () => {
		const at = new Date(Date.now() + 5 * 3600_000); // a fresh hour for this test
		let refused = 0;
		for (let i = 0; i < 31; i++) {
			try {
				await createResetLink(db, ownerId, rudoId, at);
			} catch (e) {
				if (e instanceof ResetLinkFail && e.code === 'err_rate_limited') refused++;
				else throw e;
			}
		}
		expect(refused).toBe(1);
	});
});
