/**
 * One-time password reset links, made by the owner while Tutora has no email service.
 *
 * - The owner presses "Reset password" on a person; Tutora makes a random secret, keeps only
 *   its SHA-256 hash, and shows the link once (Copy / Share on WhatsApp).
 * - The link works ONCE, for 24 hours. A newer link replaces any older unused one.
 * - Using it sets the new password, signs the person out everywhere else, clears the
 *   wrong-password lockout and any "change your password" flag. Both steps are logged
 *   (never the secret).
 */
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { account, session, user } from './db/auth.schema.ts';
import { profile, tutorProfile } from './db/app.schema.ts';
import { passwordResetLink } from './db/reset.schema.ts';
import { audit } from './owner.ts';
import { clearLimit, hitLimit } from './rate-limit.ts';

export const RESET_LINK_HOURS = 24;

export class ResetLinkFail extends Error {
	constructor(public code: string) {
		super(code);
	}
}

const b64url = (bytes: Uint8Array) =>
	btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');

export async function hashToken(token: string): Promise<string> {
	const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
	return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** A WhatsApp number from what the person gave us (digits only), or null. */
export function waNumber(raw: string | null | undefined): string | null {
	const d = String(raw ?? '').replace(/\D/g, '');
	if (d.length < 9 || d.length > 15) return null;
	// a local Zimbabwe number (07…) → international (2637…)
	if (d.startsWith('0') && d.length === 10) return `263${d.slice(1)}`;
	return d;
}

/**
 * The owner makes a link for someone. Returns the secret ONCE (only its hash is kept).
 * Not for the owner's own account (they change their password in Settings).
 */
export async function createResetLink(
	db: DB,
	ownerId: string,
	userId: string,
	now = new Date()
): Promise<{ token: string; name: string; phone: string | null; expiresAt: Date }> {
	if (userId === ownerId) throw new ResetLinkFail('rl_err_self');
	const [u] = await db
		.select({ id: user.id, name: user.name, role: user.role })
		.from(user)
		.where(eq(user.id, userId));
	if (!u) throw new ResetLinkFail('rl_err_none');
	if (u.role === 'owner') throw new ResetLinkFail('rl_err_self');
	const [cred] = await db
		.select({ id: account.id })
		.from(account)
		.where(and(eq(account.userId, userId), eq(account.providerId, 'credential')));
	if (!cred) throw new ResetLinkFail('rl_err_none');
	const limit = await hitLimit(db, 'resetLink', ownerId, now.getTime());
	if (!limit.ok) throw new ResetLinkFail('err_rate_limited');

	const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
	const expiresAt = new Date(now.getTime() + RESET_LINK_HOURS * 3600_000);
	// an older unused link stops working when a new one is made
	await db
		.update(passwordResetLink)
		.set({ usedAt: now })
		.where(and(eq(passwordResetLink.userId, userId), isNull(passwordResetLink.usedAt)));
	await db.insert(passwordResetLink).values({
		userId,
		tokenHash: await hashToken(token),
		createdBy: ownerId,
		createdAt: now,
		expiresAt
	});
	await audit(db, ownerId, 'reset_link_made', userId, u.name);

	const [p] = await db
		.select({ phone: profile.phone, parentPhone: profile.parentPhone })
		.from(profile)
		.where(eq(profile.userId, userId));
	const [t] = await db
		.select({ wa: tutorProfile.whatsappNumber, phone: tutorProfile.phone })
		.from(tutorProfile)
		.where(eq(tutorProfile.tutorId, userId));
	const phone = waNumber(t?.wa) ?? waNumber(t?.phone) ?? waNumber(p?.phone) ?? null;
	return { token, name: u.name, phone, expiresAt };
}

/** The person a link is for, or why it can't be used. */
export async function readResetLink(
	db: DB,
	token: string,
	now = new Date()
): Promise<{ ok: true; userId: string; name: string } | { ok: false; reason: 'gone' }> {
	if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return { ok: false, reason: 'gone' };
	const [r] = await db
		.select({
			userId: passwordResetLink.userId,
			name: user.name,
			usedAt: passwordResetLink.usedAt,
			expiresAt: passwordResetLink.expiresAt
		})
		.from(passwordResetLink)
		.innerJoin(user, eq(user.id, passwordResetLink.userId))
		.where(eq(passwordResetLink.tokenHash, await hashToken(token)));
	if (!r || r.usedAt || r.expiresAt.getTime() <= now.getTime())
		return { ok: false, reason: 'gone' };
	return { ok: true, userId: r.userId, name: r.name };
}

/**
 * Uses a link: claims it (once, even if two tabs press at the same moment), sets the new
 * password, signs the person out everywhere, clears the lockout and the change flag.
 */
export async function useResetLink(
	deps: { db: DB; hashPassword: (pw: string) => Promise<string> },
	token: string,
	password: string,
	now = new Date()
): Promise<{ ok: true; userId: string } | { ok: false; reason: 'gone' }> {
	const { db } = deps;
	if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return { ok: false, reason: 'gone' };
	const hash = await hashToken(token);
	const [claimed] = await db
		.update(passwordResetLink)
		.set({ usedAt: now })
		.where(
			and(
				eq(passwordResetLink.tokenHash, hash),
				isNull(passwordResetLink.usedAt),
				gt(passwordResetLink.expiresAt, now)
			)
		)
		.returning({ userId: passwordResetLink.userId });
	if (!claimed) return { ok: false, reason: 'gone' };
	const pwHash = await deps.hashPassword(password);
	const [u] = await db
		.select({ email: user.email, name: user.name })
		.from(user)
		.where(eq(user.id, claimed.userId));
	await db
		.update(account)
		.set({ password: pwHash, updatedAt: now })
		.where(and(eq(account.userId, claimed.userId), eq(account.providerId, 'credential')));
	await db.delete(session).where(eq(session.userId, claimed.userId));
	await db
		.update(user)
		.set({ mustChangePassword: false, updatedAt: now })
		.where(eq(user.id, claimed.userId));
	if (u?.email) await clearLimit(db, 'loginFail', u.email.toLowerCase());
	await audit(db, claimed.userId, 'reset_link_used', claimed.userId, u?.name ?? null);
	return { ok: true, userId: claimed.userId };
}

/** How many links are still waiting to be used (owner overview, tests). */
export async function openResetLinks(db: DB, userId: string, now = new Date()) {
	const [r] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(passwordResetLink)
		.where(
			and(
				eq(passwordResetLink.userId, userId),
				isNull(passwordResetLink.usedAt),
				gt(passwordResetLink.expiresAt, now)
			)
		);
	return r?.n ?? 0;
}
