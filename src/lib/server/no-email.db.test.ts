import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshDb, hasTestDb, testAuth } from './testing/db.ts';
import { signUp } from './actions/signup.ts';
import { logIn } from './actions/login.ts';
import { claimOwner, ownerExists } from './actions/setup.ts';
import { changeEmailNow, setPasswordFor, tempPassword } from './account.ts';
import { DbStore } from './db-store.ts';
import { createSetupCode, hasSetupCode } from './setup-code.ts';
import { session, user } from './db/schema.ts';
import type { DB } from './db/types.ts';

const PW = 'correct-horse-1';

/** The site as published with no email service and no TUTOR_EMAIL. */
describe.skipIf(!hasTestDb)('running without an email service (real database)', () => {
	let db: DB;
	let close: () => Promise<void>;
	let auth: ReturnType<typeof testAuth>['auth'];
	let outbox: ReturnType<typeof testAuth>['outbox'];

	beforeAll(async () => {
		({ db, close } = await freshDb());
		({ auth, outbox } = testAuth(db, { emailEnabled: false }));
	});
	afterAll(async () => close?.());

	const roleOf = async (email: string) =>
		(await db.select({ role: user.role }).from(user).where(eq(user.email, email)))[0]?.role;

	it('only someone with the one-time setup code becomes the owner, and only once', async () => {
		const form = { name: 'Tendai', email: 'Boss@Example.com', password: PW, confirm: PW };
		expect(await ownerExists(db)).toBe(false);

		// no code made yet / missing / wrong code: refused, nobody created
		expect(await claimOwner({ auth, db }, { ...form, code: 'ABCD-EFGH-JKMN' })).toMatchObject({
			ok: false,
			errors: { code: 'err_setup_code' }
		});
		const code = await createSetupCode(db);
		expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
		expect((await claimOwner({ auth, db }, { ...form, code: '' })).ok).toBe(false);
		expect((await claimOwner({ auth, db }, { ...form, code: 'ABCD-EFGH-JKMN' })).ok).toBe(false);
		const mismatch = await claimOwner({ auth, db }, { ...form, confirm: 'nope-nope-1', code });
		expect(mismatch.ok).toBe(false);
		expect(await roleOf('boss@example.com')).toBeUndefined();

		// right code (any case, with or without dashes)
		const r = await claimOwner(
			{ auth, db },
			{ ...form, code: code.toLowerCase().replace(/-/g, '') }
		);
		expect(r.ok).toBe(true);
		expect(await roleOf('boss@example.com')).toBe('owner');
		expect(await hasSetupCode(db)).toBe(false); // used up

		const again = await claimOwner(
			{ auth, db },
			{ name: 'Intruder', email: 'evil@example.com', password: PW, confirm: PW, code }
		);
		expect(again.ok).toBe(false);
		expect(await roleOf('evil@example.com')).toBeUndefined();
	});

	it('an expired setup code does not work', async () => {
		const { db: db2, close: close2 } = await freshDb();
		try {
			const code = await createSetupCode(db2, -1);
			const r = await claimOwner(
				{ auth: testAuth(db2, { emailEnabled: false }).auth, db: db2 },
				{ name: 'Late', email: 'late@example.com', password: PW, confirm: PW, code }
			);
			expect(r).toMatchObject({ ok: false, errors: { code: 'err_setup_code' } });
		} finally {
			await close2();
		}
	});

	it('students sign up and log in straight away, no email sent', async () => {
		const r = await signUp(
			{ auth, db },
			{
				name: 'Rudo',
				email: 'rudo@example.com',
				password: PW,
				consent: 'on',
				accountType: 'student'
			}
		);
		expect(r.ok).toBe(true);
		expect(await roleOf('rudo@example.com')).toBe('student');
		const login = await logIn({ auth }, { email: 'rudo@example.com', password: PW }, new Headers());
		expect(login.ok).toBe(true);
		expect(outbox).toHaveLength(0);
	});

	it('the tutor can give a student a temporary password; old sessions end', async () => {
		const [rudo] = await db.select().from(user).where(eq(user.email, 'rudo@example.com'));
		const pw = tempPassword();
		expect(pw).toMatch(/^[a-z2-9]{4}-[a-z2-9]{6}$/);
		expect(await setPasswordFor({ auth, db }, rudo.id, pw)).toBe(true);
		expect(await db.select().from(session).where(eq(session.userId, rudo.id))).toHaveLength(0);
		expect(
			(await logIn({ auth }, { email: 'rudo@example.com', password: PW }, new Headers())).ok
		).toBe(false);
		expect(
			(await logIn({ auth }, { email: 'rudo@example.com', password: pw }, new Headers())).ok
		).toBe(true);
	});

	it('changes a login email directly, refusing one already in use', async () => {
		const [t] = await db.select().from(user).where(eq(user.email, 'boss@example.com'));
		expect(await changeEmailNow(db, t.id, 'RUDO@example.com')).toBe('taken');
		expect(await changeEmailNow(db, t.id, 'boss@example.com')).toBe('same');
		expect(await changeEmailNow(db, t.id, 'new.boss@example.com')).toBe('ok');
		expect(await roleOf('new.boss@example.com')).toBe('owner');
	});

	it('stores files in the database when there is no bucket', async () => {
		const store = new DbStore(db);
		await store.put('a/b.pdf', new Uint8Array([1, 2, 3]), 'application/pdf');
		const f = await store.get('a/b.pdf');
		expect(f && Array.from(f.body)).toEqual([1, 2, 3]);
		expect(f?.contentType).toBe('application/pdf');
		await store.delete('a/b.pdf');
		expect(await store.get('a/b.pdf')).toBeNull();
	});
});
