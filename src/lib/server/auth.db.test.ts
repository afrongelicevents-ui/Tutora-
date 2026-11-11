import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createOTP } from '@better-auth/utils/otp';
import { base32 } from '@better-auth/utils/base32';
import { cookieHeader, freshDb, hasTestDb, linkIn, testAuth, TUTOR_EMAIL } from './testing/db.ts';
import { signUp } from './actions/signup.ts';
import { logIn } from './actions/login.ts';
import { signUpTutor } from './actions/setup.ts';
import { tutorProfile } from './db/app.schema.ts';
import { profile, user } from './db/schema.ts';
import type { DB } from './db/types.ts';

const PASSWORD = 'correct-horse-1';
const base = { password: PASSWORD, consent: 'on', phone: '0771 234 567' };

describe.skipIf(!hasTestDb)('accounts, roles and 2FA (real database)', () => {
	let db: DB;
	let close: () => Promise<void>;
	let auth: ReturnType<typeof testAuth>['auth'];
	let outbox: ReturnType<typeof testAuth>['outbox'];

	beforeAll(async () => {
		({ db, close } = await freshDb());
		({ auth, outbox } = testAuth(db));
	});
	afterAll(async () => close?.());

	async function roleOf(email: string) {
		const [u] = await db.select({ role: user.role }).from(user).where(eq(user.email, email));
		return u?.role;
	}

	async function verify(email: string) {
		const mail = outbox
			.filter((m) => m.to === email && /Confirm your email/.test(m.subject))
			.at(-1);
		const link = linkIn(mail);
		expect(link.pathname).toBe('/api/auth/verify-email');
		await auth.api.verifyEmail({ query: { token: link.searchParams.get('token')! } });
	}

	it('creates a student, emails a verification link and stores consent', async () => {
		const r = await signUp(
			{ auth, db },
			{ ...base, name: 'Rudo', email: 'rudo@example.com', accountType: 'student' }
		);
		expect(r).toMatchObject({ ok: true, email: 'rudo@example.com' });
		expect(await roleOf('rudo@example.com')).toBe('student');
		expect(outbox.at(-1)?.subject).toMatch(/Confirm your email/);
		const [p] = await db.select().from(profile);
		expect(p.consentAt).toBeInstanceOf(Date);
	});

	it('creates a parent account', async () => {
		await signUp(
			{ auth, db },
			{
				...base,
				name: 'Mai Rudo',
				email: 'mai@example.com',
				accountType: 'parent',
				childName: 'Kid'
			}
		);
		expect(await roleOf('mai@example.com')).toBe('parent');
	});

	it('stores the parent contact for an under-18 student, and the database enforces it', async () => {
		const r = await signUp(
			{ auth, db },
			{
				...base,
				name: 'Kid',
				email: 'kid@example.com',
				accountType: 'student',
				isUnder18: 'on',
				parentName: 'Baba',
				parentPhone: '+263771234567'
			}
		);
		expect(r.ok).toBe(true);
		const [u] = await db.select().from(user).where(eq(user.email, 'kid@example.com'));
		const [p] = await db.select().from(profile).where(eq(profile.userId, u.id));
		expect(p).toMatchObject({ isUnder18: true, parentName: 'Baba', parentPhone: '+263771234567' });
		await expect(
			db
				.insert(profile)
				.values({
					userId: (await db.select().from(user).where(eq(user.email, 'mai@example.com')))[0].id,
					isUnder18: true,
					consentAt: new Date()
				})
				.onConflictDoUpdate({ target: profile.userId, set: { isUnder18: true } })
		).rejects.toThrow();
	});

	it('nobody can make themselves a tutor or owner through sign-up', async () => {
		// and the role field is not accepted from anyone calling the auth API
		await auth.api
			.signUpEmail({
				body: {
					name: 'Sneaky',
					email: 'sneaky@example.com',
					password: PASSWORD,
					role: 'tutor'
				} as never
			})
			.catch(() => {});
		expect(await roleOf('sneaky@example.com')).not.toBe('tutor');
	});

	it("a tutor who joins can log in but waits for the owner's approval", async () => {
		const bad = await signUpTutor(
			{ auth, db },
			{ name: 'T', email: 'x', password: 'short', confirm: 'other' }
		);
		expect(bad.ok).toBe(false);
		const r = await signUpTutor(
			{ auth, db },
			{
				name: 'Mr T. Moyo',
				email: TUTOR_EMAIL,
				password: PASSWORD,
				confirm: PASSWORD,
				terms: 'on',
				phone: '+263 77 123 4567',
				town: 'Harare'
			}
		);
		expect(r.ok).toBe(true);
		expect(await roleOf(TUTOR_EMAIL)).toBe('tutor');
		const [p] = await db
			.select()
			.from(tutorProfile)
			.where(eq(tutorProfile.tutorId, r.ok ? r.userId : ''));
		expect(p).toMatchObject({
			status: 'draft',
			slug: 'mr-t-moyo',
			tutorName: 'Mr T. Moyo',
			phone: '+263771234567',
			town: 'Harare'
		});
		// the email is not confirmed yet; a confirmation link was sent
		await verify(TUTOR_EMAIL);
		// the same email cannot join twice
		const again = await signUpTutor(
			{ auth, db },
			{
				name: 'Copy',
				email: TUTOR_EMAIL,
				password: PASSWORD,
				confirm: PASSWORD,
				terms: 'on',
				phone: '0771234567'
			}
		);
		expect(again).toEqual({ ok: false, errors: { email: 'err_email_taken' } });
	});

	it('the real owner can take back an email a stranger signed up with', async () => {
		await signUp(
			{ auth, db },
			{
				...base,
				name: 'Stranger',
				email: 'owner@example.com',
				accountType: 'parent',
				childName: 'Kid',
				password: 'stranger-pass-1'
			}
		);
		// owner tries to sign up: nothing changes, but they get a heads-up email
		await signUp(
			{ auth, db },
			{ ...base, name: 'Owner', email: 'owner@example.com', accountType: 'student' }
		);
		expect(outbox.at(-1)).toMatchObject({
			to: 'owner@example.com',
			subject: expect.stringMatching(/tried to sign up/)
		});
		// stranger cannot log in (unconfirmed) and that does not send the owner a new link
		const sent = outbox.length;
		expect(
			(
				await logIn(
					{ auth },
					{ email: 'owner@example.com', password: 'stranger-pass-1' },
					new Headers()
				)
			).ok
		).toBe(false);
		expect(outbox.length).toBe(sent);
		// owner resets the password from their inbox: address confirmed, stranger locked out
		await auth.api.requestPasswordReset({
			body: { email: 'owner@example.com', redirectTo: '/reset-password' }
		});
		const token = linkIn(outbox.at(-1)).pathname.split('/').at(-1)!;
		await auth.api.resetPassword({ body: { token, newPassword: 'owners-own-pass' } });
		expect(
			(
				await logIn(
					{ auth },
					{ email: 'owner@example.com', password: 'stranger-pass-1' },
					new Headers()
				)
			).ok
		).toBe(false);
		expect(
			await logIn(
				{ auth },
				{ email: 'owner@example.com', password: 'owners-own-pass' },
				new Headers()
			)
		).toEqual({ ok: true, twoFactor: false });
	});

	it('signing up again with a taken email reveals nothing and changes nothing', async () => {
		const before = await db.select().from(user);
		const r = await signUp(
			{ auth, db },
			{
				...base,
				name: 'Attacker',
				email: 'rudo@example.com',
				accountType: 'parent',
				childName: 'Kid',
				password: 'attacker-pass-1'
			}
		);
		expect(r).toEqual({ ok: true, email: 'rudo@example.com' });
		const after = await db.select().from(user);
		expect(after).toHaveLength(before.length);
		expect(await roleOf('rudo@example.com')).toBe('student');
	});

	it('blocks login until the email is verified, then allows it', async () => {
		const before = await logIn(
			{ auth },
			{ email: 'rudo@example.com', password: PASSWORD },
			new Headers()
		);
		expect(before).toEqual({ ok: false, errors: { form: 'login_unverified' } });
		await verify('rudo@example.com');
		const after = await logIn(
			{ auth },
			{ email: 'rudo@example.com', password: PASSWORD },
			new Headers()
		);
		expect(after).toEqual({ ok: true, twoFactor: false });
		const wrong = await logIn(
			{ auth },
			{ email: 'rudo@example.com', password: 'wrong-password' },
			new Headers()
		);
		expect(wrong).toEqual({ ok: false, errors: { form: 'err_login' } });
	});

	it('tutor turns on 2FA with an authenticator code, then login needs the code', async () => {
		const signIn = await auth.api.signInEmail({
			body: { email: TUTOR_EMAIL, password: PASSWORD },
			asResponse: true
		});
		let cookies = cookieHeader(signIn);

		const enabled = await auth.api.enableTwoFactor({
			body: { password: PASSWORD },
			headers: new Headers({ cookie: cookies })
		});
		if (enabled.method !== 'totp') throw new Error('expected totp');
		expect(enabled.backupCodes.length).toBeGreaterThan(5);
		const secret = new URL(enabled.totpURI).searchParams.get('secret')!;
		const otp = createOTP(base32.decode(secret));

		// not on until a code is confirmed
		const [pending] = await db
			.select({ on: user.twoFactorEnabled })
			.from(user)
			.where(eq(user.email, TUTOR_EMAIL));
		expect(pending.on).toBe(false);

		await auth.api.verifyTOTP({
			body: { code: await otp.totp() },
			headers: new Headers({ cookie: cookies })
		});
		const [on] = await db
			.select({ on: user.twoFactorEnabled })
			.from(user)
			.where(eq(user.email, TUTOR_EMAIL));
		expect(on.on).toBe(true);

		// next login asks for the code
		const second = await auth.api.signInEmail({
			body: { email: TUTOR_EMAIL, password: PASSWORD },
			asResponse: true
		});
		expect(((await second.json()) as { twoFactorRedirect?: boolean }).twoFactorRedirect).toBe(true);
		cookies = cookieHeader(second);
		await expect(
			auth.api.verifyTOTP({ body: { code: '000000' }, headers: new Headers({ cookie: cookies }) })
		).rejects.toThrow();
		const done = await auth.api.verifyTOTP({
			body: { code: await otp.totp() },
			headers: new Headers({ cookie: cookies }),
			asResponse: true
		});
		expect(done.status).toBe(200);
		const session = await auth.api.getSession({
			headers: new Headers({ cookie: cookieHeader(done, cookies) })
		});
		expect(session?.user.role).toBe('tutor');
		expect(session?.user.twoFactorEnabled).toBe(true);
	});

	it('sends a password reset link that works once', async () => {
		await auth.api.requestPasswordReset({
			body: { email: 'rudo@example.com', redirectTo: '/reset-password' }
		});
		const link = linkIn(outbox.at(-1));
		const token = link.pathname.split('/').at(-1)!;
		await auth.api.resetPassword({ body: { token, newPassword: 'a-brand-new-pass' } });
		await expect(
			auth.api.resetPassword({ body: { token, newPassword: 'again-new-pass1' } })
		).rejects.toThrow();
		const r = await logIn(
			{ auth },
			{ email: 'rudo@example.com', password: 'a-brand-new-pass' },
			new Headers()
		);
		expect(r.ok).toBe(true);
	});
});
