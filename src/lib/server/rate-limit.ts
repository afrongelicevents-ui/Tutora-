import { sql } from 'drizzle-orm';
import type { DB } from './db/types';
import { actionLimit } from './db/app.schema';

export interface LimitRule {
	max: number;
	windowSeconds: number;
}

/** Limits for app actions. Better Auth also limits its own endpoints. */
export const LIMITS = {
	login: { max: 5, windowSeconds: 60 },
	/** per account, from any IP: stops slow password guessing spread over many addresses */
	loginAccount: { max: 40, windowSeconds: 60 * 60 },
	/** WRONG passwords for one account: 10 in 30 minutes locks it for the rest of the window */
	loginFail: { max: 10, windowSeconds: 30 * 60 },
	tutorSetup: { max: 5, windowSeconds: 60 * 60 },
	signup: { max: 5, windowSeconds: 60 * 60 },
	passwordReset: { max: 3, windowSeconds: 60 * 60 },
	twoFactor: { max: 5, windowSeconds: 60 },
	booking: { max: 10, windowSeconds: 60 * 60 },
	upload: { max: 20, windowSeconds: 60 * 60 },
	/** whole-site login tries from one address (stops trying one password on many accounts) */
	loginIp: { max: 30, windowSeconds: 10 * 60 },
	/** Family Connection codes tried from one address (codes have 887 million values) */
	familyCode: { max: 10, windowSeconds: 60 * 60 },
	/** a teacher's School+ page (per address and link) */
	schoolLink: { max: 60, windowSeconds: 60 * 60 },
	/** invite codes made by one student */
	familyInvite: { max: 10, windowSeconds: 24 * 60 * 60 },
	/** lesson-room set-up messages per person per minute */
	signal: { max: 150, windowSeconds: 60 },
	/** buddy codes tried per student: stops guessing */
	buddyCode: { max: 10, windowSeconds: 60 * 60 },
	/** profile photos uploaded per student */
	profilePhoto: { max: 10, windowSeconds: 24 * 60 * 60 },
	/** student ↔ tutor messages sent per person */
	message: { max: 150, windowSeconds: 24 * 60 * 60 },
	/** reports about buddies per student */
	buddyReport: { max: 10, windowSeconds: 24 * 60 * 60 },
	/** new buddy codes made per student */
	buddyNewCode: { max: 10, windowSeconds: 24 * 60 * 60 },
	/** "something to check" notes sent to the owner, per student */
	ownerNotice: { max: 5, windowSeconds: 60 * 60 },
	/** "ask my parent to talk" per student */
	talkParent: { max: 3, windowSeconds: 24 * 60 * 60 }
} satisfies Record<string, LimitRule>;

export type LimitName = keyof typeof LIMITS;

export interface LimitResult {
	ok: boolean;
	remaining: number;
	retryAfterSeconds: number;
}

/**
 * Fixed-window counter stored in Postgres, so it works across Cloudflare isolates.
 * One atomic upsert per call.
 */
export async function hitLimit(
	db: DB,
	name: LimitName,
	identity: string,
	now = Date.now(),
	rule: LimitRule = LIMITS[name]
): Promise<LimitResult> {
	const key = `${name}:${identity}`;
	const resetAt = now + rule.windowSeconds * 1000;
	const rows = await db
		.insert(actionLimit)
		.values({ key, count: 1, resetAt })
		.onConflictDoUpdate({
			target: actionLimit.key,
			set: {
				count: sql`case when ${actionLimit.resetAt} <= ${now} then 1 else ${actionLimit.count} + 1 end`,
				resetAt: sql`case when ${actionLimit.resetAt} <= ${now} then ${resetAt} else ${actionLimit.resetAt} end`
			}
		})
		.returning({ count: actionLimit.count, resetAt: actionLimit.resetAt });
	const row = rows[0];
	return {
		ok: row.count <= rule.max,
		remaining: Math.max(0, rule.max - row.count),
		retryAfterSeconds: Math.max(0, Math.ceil((Number(row.resetAt) - now) / 1000))
	};
}

/** Looks at a limit without counting a try (for a lockout check before the password). */
export async function peekLimit(
	db: DB,
	name: LimitName,
	identity: string,
	now = Date.now(),
	rule: LimitRule = LIMITS[name]
): Promise<LimitResult> {
	const rows = await db
		.select({ count: actionLimit.count, resetAt: actionLimit.resetAt })
		.from(actionLimit)
		.where(sql`${actionLimit.key} = ${`${name}:${identity}`}`);
	const row = rows[0];
	if (!row || Number(row.resetAt) <= now)
		return { ok: true, remaining: rule.max, retryAfterSeconds: 0 };
	return {
		ok: row.count < rule.max,
		remaining: Math.max(0, rule.max - row.count),
		retryAfterSeconds: Math.max(0, Math.ceil((Number(row.resetAt) - now) / 1000))
	};
}

/** Forgets a limit (a right password ends a run of wrong ones). */
export async function clearLimit(db: DB, name: LimitName, identity: string) {
	await db.delete(actionLimit).where(sql`${actionLimit.key} = ${`${name}:${identity}`}`);
}

/** Best-effort client identity: Cloudflare sets cf-connecting-ip. */
export function clientIp(request: Request, fallback = 'unknown'): string {
	return (
		request.headers.get('cf-connecting-ip') ??
		request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
		fallback
	);
}
