import { and, eq, ne, sql } from 'drizzle-orm';
import type { Auth } from './auth-config.ts';
import type { DB } from './db/types.ts';
import { account, session, user } from './db/schema.ts';

export type EmailChange = 'ok' | 'same' | 'taken';

/**
 * Changes a login email straight away. Only used when the site has no email service
 * (so no confirmation link can be sent); callers must check the current password first.
 */
export async function changeEmailNow(
	db: DB,
	userId: string,
	newEmail: string
): Promise<EmailChange> {
	const email = newEmail.trim().toLowerCase();
	const [me] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId));
	if (!me) return 'taken';
	if (me.email.toLowerCase() === email) return 'same';
	const [other] = await db
		.select({ id: user.id })
		.from(user)
		.where(and(sql`lower(${user.email}) = ${email}`, ne(user.id, userId)));
	if (other) return 'taken';
	try {
		await db
			.update(user)
			.set({ email, emailVerified: true, updatedAt: new Date() })
			.where(eq(user.id, userId));
	} catch {
		return 'taken'; // unique index: someone took it at the same moment
	}
	return 'ok';
}

/**
 * The tutor sets a new temporary password for a student who forgot theirs (used when the
 * site has no email service). Logs the student out everywhere.
 */
export async function setPasswordFor(
	deps: { auth: Auth; db: DB },
	userId: string,
	password: string
): Promise<boolean> {
	const ctx = await deps.auth.$context;
	const hash = await ctx.password.hash(password);
	const updated = await deps.db
		.update(account)
		.set({ password: hash, updatedAt: new Date() })
		.where(and(eq(account.userId, userId), eq(account.providerId, 'credential')))
		.returning({ id: account.id });
	if (updated.length === 0) return false;
	await deps.db.delete(session).where(eq(session.userId, userId));
	return true;
}

/** Ten easy-to-read characters plus a dash, e.g. "kpta-7mx3qe". No look-alike letters. */
export function tempPassword(): string {
	const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
	const bytes = crypto.getRandomValues(new Uint8Array(10));
	const s = Array.from(bytes, (b) => abc[b % abc.length]).join('');
	return `${s.slice(0, 4)}-${s.slice(4)}`;
}
