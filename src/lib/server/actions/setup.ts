import { and, eq } from 'drizzle-orm';
import type { Auth } from '../auth-config.ts';
import type { DB } from '../db/types.ts';
import { user } from '../db/schema.ts';
import { emailField } from '../../validation/auth.ts';

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
