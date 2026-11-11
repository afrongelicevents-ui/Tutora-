import { and, eq } from 'drizzle-orm';
import type { Auth } from '../auth-config.ts';
import type { DB } from '../db/types.ts';
import { user } from '../db/schema.ts';
import { emailField } from '../../validation/auth.ts';
import { checkSetupCode, useUpSetupCode } from '../setup-code.ts';

/** True once the tutor has confirmed their address (by setting a password from the emailed link). */
export async function tutorIsSetUp(db: DB): Promise<boolean> {
	const rows = await db
		.select({ id: user.id })
		.from(user)
		.where(and(eq(user.role, 'tutor'), eq(user.emailVerified, true)))
		.limit(1);
	return rows.length > 0;
}

/**
 * Tutor set-up: the tutor types only their email. If it matches TUTOR_EMAIL we create the
 * account (without a password) and email a "choose your password" link. Only the person who
 * controls that inbox can finish, so nobody can claim the tutor account by signing up first.
 * The answer is the same whatever email is typed.
 */
export async function requestTutorSetup(
	deps: { auth: Auth; db: DB; tutorEmail: string },
	rawEmail: string
): Promise<{ ok: boolean }> {
	const parsed = emailField.safeParse(rawEmail);
	if (!parsed.success) return { ok: false };
	const email = parsed.data;
	if (email !== deps.tutorEmail.trim().toLowerCase()) return { ok: true };
	if (await tutorIsSetUp(deps.db)) return { ok: true };

	await deps.db
		.insert(user)
		.values({ id: crypto.randomUUID(), name: 'Tutor', email, emailVerified: false, role: 'tutor' })
		.onConflictDoUpdate({ target: user.email, set: { role: 'tutor' } });

	await deps.auth.api.requestPasswordReset({ body: { email, redirectTo: '/reset-password' } });
	return { ok: true };
}

export type ClaimResult =
	{ ok: true; userId: string } | { ok: false; errors: Record<string, string> };

/**
 * Simple set-up without an email service: whoever has the one-time setup code (made by the
 * deploy workflow) creates the tutor (admin) account with their own name, email and password.
 * The code is deleted once used, and a database rule allows only one tutor ever, so once
 * claimed, /setup is closed for good.
 */
export async function claimTutor(
	deps: { auth: Auth; db: DB },
	input: { name: string; email: string; password: string; confirm: string; code: string }
): Promise<ClaimResult> {
	if (await tutorExists(deps.db)) return { ok: false, errors: { form: 'setup_done' } };
	// The one-time code from the deploy proves this is the owner, not a passer-by.
	if (!(await checkSetupCode(deps.db, input.code ?? '')))
		return { ok: false, errors: { code: 'err_setup_code' } };
	const name = input.name.trim().slice(0, 80);
	const email = emailField.safeParse(input.email);
	const errors: Record<string, string> = {};
	if (name.length < 2) errors.name = 'err_name';
	if (!email.success) errors.email = 'err_email';
	if (input.password.length < 10) errors.password = 'err_password_short';
	else if (input.password.length > 128) errors.password = 'err_too_long';
	if (input.password !== input.confirm) errors.confirm = 'err_password_match';
	if (Object.keys(errors).length || !email.success) return { ok: false, errors };

	const res = await deps.auth.api.signUpEmail({
		body: { name, email: email.data, password: input.password }
	});
	const [created] = await deps.db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.id, res.user.id));
	// the email is already used by another account
	if (!created) return { ok: false, errors: { email: 'err_email_taken' } };
	try {
		await deps.db
			.update(user)
			.set({ role: 'tutor', emailVerified: true })
			.where(eq(user.id, created.id));
	} catch {
		// someone else claimed it at the same moment: remove this account again
		await deps.db.delete(user).where(eq(user.id, created.id));
		return { ok: false, errors: { form: 'setup_done' } };
	}
	await useUpSetupCode(deps.db);
	return { ok: true, userId: created.id };
}

/** Is there a tutor account at all (verified or not)? */
export async function tutorExists(db: DB): Promise<boolean> {
	const rows = await db.select({ id: user.id }).from(user).where(eq(user.role, 'tutor')).limit(1);
	return rows.length > 0;
}
