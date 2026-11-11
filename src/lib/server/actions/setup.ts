import { eq } from 'drizzle-orm';
import type { Auth } from '../auth-config.ts';
import type { DB } from '../db/types.ts';
import { user } from '../db/schema.ts';
import { emailField } from '../../validation/auth.ts';
import { checkSetupCode, useUpSetupCode } from '../setup-code.ts';
import { createTutorProfile } from '../settings.ts';

export type AccountResult =
	{ ok: true; userId: string } | { ok: false; errors: Record<string, string> };

interface NewAccount {
	name: string;
	email: string;
	password: string;
	confirm: string;
}

function check(input: NewAccount) {
	const name = input.name.trim().slice(0, 80);
	const email = emailField.safeParse(input.email);
	const errors: Record<string, string> = {};
	if (name.length < 2) errors.name = 'err_name';
	if (!email.success) errors.email = 'err_email';
	if (input.password.length < 10) errors.password = 'err_password_short';
	else if (input.password.length > 128) errors.password = 'err_too_long';
	if (input.password !== input.confirm) errors.confirm = 'err_password_match';
	return { name, email: email.success ? email.data : '', errors };
}

/**
 * Creates a login WITHOUT logging anyone in (so the owner adding a tutor stays logged in as
 * themselves). It starts as "student" (see auth-config); the caller then sets the role.
 * Returns null if the email already has an account.
 */
async function createLogin(auth: Auth, db: DB, name: string, email: string, password: string) {
	const ctx = await auth.$context;
	if (await ctx.internalAdapter.findUserByEmail(email)) return null;
	let u: { id: string };
	try {
		u = await ctx.internalAdapter.createUser(
			{ name, email: email.toLowerCase(), emailVerified: false },
			{ method: 'email-password' }
		);
	} catch {
		return null; // the same email was taken at the same moment
	}
	await ctx.internalAdapter.linkAccount({
		userId: u.id,
		providerId: 'credential',
		accountId: u.id,
		password: await ctx.password.hash(password)
	});
	const [created] = await db
		.select({ id: user.id, role: user.role })
		.from(user)
		.where(eq(user.id, u.id));
	return created?.id ?? null;
}

/** Is there a platform owner yet? */
export async function ownerExists(db: DB): Promise<boolean> {
	const rows = await db.select({ id: user.id }).from(user).where(eq(user.role, 'owner')).limit(1);
	return rows.length > 0;
}

/**
 * The platform owner's account, made at /setup with the one-time code from the deploy.
 * The code is deleted once used, so this works exactly once.
 */
export async function claimOwner(
	deps: { auth: Auth; db: DB },
	input: NewAccount & { code: string }
): Promise<AccountResult> {
	if (await ownerExists(deps.db)) return { ok: false, errors: { form: 'setup_done' } };
	if (!(await checkSetupCode(deps.db, input.code ?? '')))
		return { ok: false, errors: { code: 'err_setup_code' } };
	const v = check(input);
	if (Object.keys(v.errors).length) return { ok: false, errors: v.errors };
	const id = await createLogin(deps.auth, deps.db, v.name, v.email, input.password);
	if (!id) return { ok: false, errors: { email: 'err_email_taken' } };
	// use the code up first: if two people race with the same code, only one gets here
	const used = await useUpSetupCode(deps.db);
	if (!used) {
		await deps.db.delete(user).where(eq(user.id, id));
		return { ok: false, errors: { code: 'err_setup_code' } };
	}
	await deps.db.update(user).set({ role: 'owner', emailVerified: true }).where(eq(user.id, id));
	return { ok: true, userId: id };
}

/**
 * A tutor joins Tutora (from /join). The account works straight away but the tutor area
 * stays locked until the platform owner approves it.
 */
export async function signUpTutor(
	deps: { auth: Auth; db: DB },
	input: NewAccount & { terms?: string }
): Promise<AccountResult> {
	const v = check(input);
	if (input.terms !== 'on') v.errors.terms = 'err_consent';
	if (Object.keys(v.errors).length) return { ok: false, errors: v.errors };
	const id = await createLogin(deps.auth, deps.db, v.name, v.email, input.password);
	if (!id) return { ok: false, errors: { email: 'err_email_taken' } };
	// The email is not confirmed: the owner sees that before approving. When an email service is
	// on, a confirmation link is sent (without one, sending quietly does nothing).
	await deps.db.update(user).set({ role: 'tutor' }).where(eq(user.id, id));
	// starts as a draft: the tutor fills in their profile, then submits it for approval
	await createTutorProfile(deps.db, id, v.name, 'draft');
	await deps.auth.api
		.sendVerificationEmail({ body: { email: v.email, callbackURL: '/login' } })
		.catch(() => {});
	return { ok: true, userId: id };
}

/** The owner adds a tutor directly (approved straight away, with a temporary password). */
export async function addTutorByOwner(
	deps: { auth: Auth; db: DB },
	input: { name: string; email: string; password: string }
): Promise<AccountResult> {
	const v = check({ ...input, confirm: input.password });
	if (Object.keys(v.errors).length) return { ok: false, errors: v.errors };
	const id = await createLogin(deps.auth, deps.db, v.name, v.email, input.password);
	if (!id) return { ok: false, errors: { email: 'err_email_taken' } };
	// the owner knows this temporary password: the tutor must choose their own at first login
	await deps.db
		.update(user)
		.set({ role: 'tutor', emailVerified: true, mustChangePassword: true })
		.where(eq(user.id, id));
	await createTutorProfile(deps.db, id, v.name, 'active');
	return { ok: true, userId: id };
}
