/**
 * The owner gives Tutora Family or Tutora Pro free to chosen people (e.g. a relative or a
 * pilot school), with an optional end date. Read by familyAccess and proAccess.
 */
import { and, desc, eq, gt, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { user } from './db/auth.schema.ts';
import { familyLink } from './db/v3.schema.ts';
import { planGift, GIFT_PLANS, type GiftPlan } from './db/pro.schema.ts';

export class GiftFail extends Error {
	constructor(public code: string) {
		super(code);
	}
}

/**
 * The gift that gives this person the plan now, if any. With `viaParents`, a Family gift to
 * a parent who actively follows the person counts too (a gift to a parent covers the children).
 */
export async function activeGift(
	db: DB,
	plan: GiftPlan,
	userId: string,
	now = new Date(),
	viaParents = false
) {
	const who = viaParents
		? or(
				eq(planGift.userId, userId),
				inArray(
					planGift.userId,
					db
						.select({ id: familyLink.parentId })
						.from(familyLink)
						.where(and(eq(familyLink.studentId, userId), eq(familyLink.status, 'active')))
				)
			)
		: eq(planGift.userId, userId);
	const [g] = await db
		.select({ id: planGift.id, until: planGift.until })
		.from(planGift)
		.where(and(eq(planGift.plan, plan), who, or(isNull(planGift.until), gt(planGift.until, now))))
		.limit(1);
	return g ?? null;
}

/** Owner: every gift, newest first, with the person's name, email and role. */
export function listGifts(db: DB) {
	return db
		.select({
			id: planGift.id,
			userId: planGift.userId,
			plan: planGift.plan,
			until: planGift.until,
			note: planGift.note,
			createdAt: planGift.createdAt,
			name: user.name,
			email: user.email,
			role: user.role
		})
		.from(planGift)
		.innerJoin(user, eq(user.id, planGift.userId))
		.orderBy(desc(planGift.createdAt))
		.limit(200);
}

/** Owner: find a person by name or email (to give a plan to). */
export function findPeople(db: DB, q: string) {
	const s = q.trim().slice(0, 80);
	if (s.length < 2) return Promise.resolve([]);
	const like = `%${s.replace(/[%_\\]/g, (c) => '\\' + c)}%`;
	return db
		.select({ id: user.id, name: user.name, email: user.email, role: user.role })
		.from(user)
		.where(
			and(
				or(ilike(user.name, like), ilike(user.email, like)),
				inArray(user.role, ['tutor', 'parent', 'student'])
			)
		)
		.orderBy(user.name)
		.limit(10);
}

/** Which plan fits which role: Pro is for tutors, Family for parents and students. */
export function planFits(plan: GiftPlan, role: string | null | undefined) {
	return plan === 'pro' ? role === 'tutor' : role === 'parent' || role === 'student';
}

export async function giveGift(
	db: DB,
	ownerId: string,
	v: { userId: string; plan: string; until?: string | null; note?: string | null }
) {
	if (!(GIFT_PLANS as readonly string[]).includes(v.plan)) throw new GiftFail('gift_err_plan');
	const plan = v.plan as GiftPlan;
	const [who] = await db.select({ role: user.role }).from(user).where(eq(user.id, v.userId));
	if (!who) throw new GiftFail('err_not_found');
	if (!planFits(plan, who.role)) throw new GiftFail('gift_err_role');
	let until: Date | null = null;
	if (v.until) {
		until = new Date(`${v.until}T23:59:59Z`);
		if (Number.isNaN(until.getTime()) || until <= new Date()) throw new GiftFail('gift_err_date');
	}
	const note =
		String(v.note ?? '')
			.trim()
			.slice(0, 120) || null;
	await db
		.insert(planGift)
		.values({ userId: v.userId, plan, until, note, givenBy: ownerId })
		.onConflictDoUpdate({
			target: [planGift.userId, planGift.plan],
			set: { until, note, givenBy: ownerId, createdAt: sql`now()` }
		});
}

export async function removeGift(db: DB, id: number) {
	await db.delete(planGift).where(eq(planGift.id, id));
}
