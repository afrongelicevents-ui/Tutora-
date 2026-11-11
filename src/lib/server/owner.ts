import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { enrollment, lesson, payment, tutorProfile } from './db/app.schema.ts';
import { session, user } from './db/auth.schema.ts';
import type { SiteSettings } from './settings.ts';

export type TutorStatus = SiteSettings['status'];

/** Every tutor on the platform, newest first, with a few counts (owner area only). */
export async function allTutors(db: DB) {
	const rows = await db
		.select({
			tutorId: tutorProfile.tutorId,
			slug: tutorProfile.slug,
			name: tutorProfile.tutorName,
			status: tutorProfile.status,
			plan: tutorProfile.plan,
			setupDone: sql<boolean>`${tutorProfile.setupDoneAt} is not null`,
			createdAt: tutorProfile.createdAt,
			approvedAt: tutorProfile.approvedAt,
			email: user.email
		})
		.from(tutorProfile)
		.innerJoin(user, eq(user.id, tutorProfile.tutorId))
		.orderBy(
			sql`case ${tutorProfile.status} when 'pending' then 0 when 'active' then 1 else 2 end`,
			desc(tutorProfile.createdAt)
		);
	if (!rows.length) return [];
	const ids = rows.map((r) => r.tutorId);
	const [students, lessons, payments] = await Promise.all([
		db
			.select({ t: enrollment.tutorId, n: sql<number>`count(*)::int` })
			.from(enrollment)
			.where(inArray(enrollment.tutorId, ids))
			.groupBy(enrollment.tutorId),
		db
			.select({ t: lesson.tutorId, n: sql<number>`count(*)::int` })
			.from(lesson)
			.where(and(inArray(lesson.tutorId, ids), eq(lesson.status, 'scheduled')))
			.groupBy(lesson.tutorId),
		db
			.select({ t: payment.tutorId, n: sql<number>`count(*)::int` })
			.from(payment)
			.where(and(inArray(payment.tutorId, ids), eq(payment.status, 'confirmed')))
			.groupBy(payment.tutorId)
	]);
	const count = (list: { t: string; n: number }[], id: string) =>
		list.find((x) => x.t === id)?.n ?? 0;
	return rows.map((r) => ({
		...r,
		students: count(students, r.tutorId),
		lessons: count(lessons, r.tutorId),
		payments: count(payments, r.tutorId)
	}));
}

/**
 * Approve, suspend or re-activate a tutor. Suspending hides their public page, stops new
 * bookings and logs them out everywhere.
 */
export async function setTutorStatus(db: DB, tutorId: string, status: TutorStatus) {
	const done = await db
		.update(tutorProfile)
		.set({
			status,
			...(status === 'active'
				? { approvedAt: sql`coalesce(${tutorProfile.approvedAt}, now())` }
				: {})
		})
		.where(eq(tutorProfile.tutorId, tutorId))
		.returning({ id: tutorProfile.tutorId });
	if (done.length && status === 'suspended')
		await db.delete(session).where(eq(session.userId, tutorId));
	return done.length > 0;
}

export async function platformCounts(db: DB) {
	const [r] = await db
		.select({
			students: sql<number>`(select count(*)::int from ${user} where ${user.role} in ('student','parent'))`,
			tutors: sql<number>`(select count(*)::int from ${tutorProfile} where ${tutorProfile.status} = 'active')`,
			pending: sql<number>`(select count(*)::int from ${tutorProfile} where ${tutorProfile.status} = 'pending')`
		})
		.from(sql`(select 1) x`);
	return r;
}
