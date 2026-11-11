import { eq } from 'drizzle-orm';
import { APIError } from 'better-auth/api';
import type { Auth } from '../auth-config.ts';
import type { DB } from '../db/types.ts';
import { profile, user } from '../db/schema.ts';
import { signupSchema, fieldErrors } from '../../validation/auth.ts';

export type SignupResult =
	| { ok: true; email: string; userId?: string; role?: string }
	| { ok: false; errors: Record<string, string> };

/**
 * Creates the account, sets the chosen role (student or parent — never tutor) and
 * stores the profile. Kept separate from the route so it can be tested against a real database.
 */
export async function signUp(
	deps: { auth: Auth; db: DB },
	input: Record<string, string>,
	callbackURL = '/account'
): Promise<SignupResult> {
	const parsed = signupSchema.safeParse(input);
	if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
	const v = parsed.data;

	let userId: string;
	try {
		const res = await deps.auth.api.signUpEmail({
			body: { name: v.name, email: v.email, password: v.password, callbackURL }
		});
		userId = res.user.id;
	} catch (e) {
		if (e instanceof APIError) {
			const code = String((e.body as { code?: string } | undefined)?.code ?? '');
			// (only reached if enumeration protection is off)
			if (code.includes('EXISTS')) return { ok: false, errors: { email: 'err_email_taken' } };
			if (code.includes('PASSWORD'))
				return { ok: false, errors: { password: 'err_password_short' } };
		}
		throw e;
	}

	// If the email is already registered, Better Auth returns a look-alike success without
	// creating anyone (so strangers can't find out who has an account). Show the same
	// "check your email" page and change nothing.
	const [created] = await deps.db.select({ role: user.role }).from(user).where(eq(user.id, userId));
	if (!created) return { ok: true, email: v.email };

	// Accounts made here are only ever student or parent (tutors join through /join).
	if (created.role === 'student') {
		await deps.db.update(user).set({ role: v.accountType }).where(eq(user.id, userId));
	}

	await deps.db
		.insert(profile)
		.values({
			userId,
			phone: v.phone ?? null,
			isUnder18: v.isUnder18,
			parentName: v.parentName ?? null,
			parentPhone: v.parentPhone ?? null,
			parentEmail: v.parentEmail ?? null,
			childName: v.childName ?? null,
			consentAt: new Date()
		})
		.onConflictDoNothing();

	return { ok: true, email: v.email, userId, role: v.accountType };
}
