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
	loginAccount: { max: 20, windowSeconds: 60 * 60 },
	tutorSetup: { max: 3, windowSeconds: 60 * 60 },
	signup: { max: 5, windowSeconds: 60 * 60 },
	passwordReset: { max: 3, windowSeconds: 60 * 60 },
	twoFactor: { max: 5, windowSeconds: 60 },
	booking: { max: 10, windowSeconds: 60 * 60 },
	upload: { max: 20, windowSeconds: 60 * 60 },
	/** whole-site login tries from one address (stops trying one password on many accounts) */
	loginIp: { max: 30, windowSeconds: 10 * 60 },
	/** lesson-room set-up messages per person per minute */
	signal: { max: 150, windowSeconds: 60 }
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

/** Best-effort client identity: Cloudflare sets cf-connecting-ip. */
export function clientIp(request: Request, fallback = 'unknown'): string {
	return (
		request.headers.get('cf-connecting-ip') ??
		request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
		fallback
	);
}
