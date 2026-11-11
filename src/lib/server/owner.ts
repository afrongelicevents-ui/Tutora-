import { and, desc, eq, inArray, isNotNull, or, sql } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import {
	auditLog,
	booking,
	enrollment,
	lesson,
	payment,
	platformSubject,
	profile,
	review,
	supportRequest,
	tutorProfile
} from './db/app.schema.ts';
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
			email: user.email,
			emailConfirmed: user.emailVerified
		})
		.from(tutorProfile)
		.innerJoin(user, eq(user.id, tutorProfile.tutorId))
		.orderBy(
			sql`case ${tutorProfile.status} when 'pending' then 0 when 'active' then 1 when 'draft' then 2 when 'rejected' then 3 else 4 end`,
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

/* ---------- audit log: every owner action ---------- */

export async function audit(
	db: DB,
	actorId: string,
	action: string,
	target: string | null,
	detail: string | null = null
) {
	await db
		.insert(auditLog)
		.values({ actorId, action, target, detail: detail?.slice(0, 500) ?? null });
}

export const recentAudit = (db: DB, limit = 200) =>
	db
		.select({
			id: auditLog.id,
			action: auditLog.action,
			target: auditLog.target,
			detail: auditLog.detail,
			createdAt: auditLog.createdAt,
			actor: user.name
		})
		.from(auditLog)
		.leftJoin(user, eq(user.id, auditLog.actorId))
		.orderBy(desc(auditLog.createdAt), desc(auditLog.id))
		.limit(limit);

/** Not approved, with a reason the tutor sees; they can change their profile and send it again. */
export async function rejectTutor(db: DB, tutorId: string, reason: string) {
	const done = await db
		.update(tutorProfile)
		.set({ status: 'rejected', rejectReason: reason })
		.where(eq(tutorProfile.tutorId, tutorId))
		.returning({ id: tutorProfile.tutorId });
	return done.length > 0;
}

/* ---------- students and parents ---------- */

export function allStudents(db: DB, q?: string) {
	const search = q?.trim();
	return db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role,
			createdAt: user.createdAt,
			suspendedAt: user.suspendedAt,
			phone: profile.phone
		})
		.from(user)
		.leftJoin(profile, eq(profile.userId, user.id))
		.where(
			and(
				inArray(user.role, ['student', 'parent']),
				search
					? sql`(${user.name} ilike ${'%' + search.replace(/[\\%_]/g, (c) => '\\' + c) + '%'} or ${user.email} ilike ${'%' + search.replace(/[\\%_]/g, (c) => '\\' + c) + '%'})`
					: undefined
			)
		)
		.orderBy(desc(user.createdAt))
		.limit(200);
}

/** Suspend or restore a student/parent account (suspended: can't log in, logged out now). */
export async function setStudentSuspended(db: DB, userId: string, suspended: boolean) {
	const done = await db
		.update(user)
		.set({ suspendedAt: suspended ? new Date() : null })
		.where(and(eq(user.id, userId), inArray(user.role, ['student', 'parent'])))
		.returning({ id: user.id });
	if (done.length && suspended) await db.delete(session).where(eq(session.userId, userId));
	return done.length > 0;
}

/* ---------- all bookings and payments (to look into problems) ---------- */

export function allBookings(db: DB, status?: string) {
	const st = ['requested', 'accepted', 'declined', 'proposed', 'cancelled'].includes(status ?? '')
		? (status as 'requested')
		: undefined;
	return db
		.select({
			id: booking.id,
			status: booking.status,
			kind: booking.kind,
			startsAt: booking.startsAt,
			createdAt: booking.createdAt,
			studentName: user.name,
			tutorName: tutorProfile.tutorName
		})
		.from(booking)
		.innerJoin(user, eq(user.id, booking.userId))
		.innerJoin(tutorProfile, eq(tutorProfile.tutorId, booking.tutorId))
		.where(st ? eq(booking.status, st) : undefined)
		.orderBy(desc(booking.createdAt))
		.limit(100);
}

export function allPayments(db: DB, status?: string, staleOnly = false) {
	const st = ['pending', 'confirmed', 'rejected'].includes(status ?? '')
		? (status as 'pending')
		: undefined;
	return db
		.select({
			id: payment.id,
			status: payment.status,
			method: payment.method,
			amountCents: payment.amountCents,
			currency: payment.currency,
			createdAt: payment.createdAt,
			receiptNo: payment.receiptNo,
			studentName: user.name,
			tutorName: tutorProfile.tutorName
		})
		.from(payment)
		.innerJoin(user, eq(user.id, payment.userId))
		.innerJoin(tutorProfile, eq(tutorProfile.tutorId, payment.tutorId))
		.where(
			and(
				staleOnly ? eq(payment.status, 'pending') : st ? eq(payment.status, st) : undefined,
				staleOnly ? sql`${payment.createdAt} < now() - interval '7 days'` : undefined
			)
		)
		.orderBy(desc(payment.createdAt))
		.limit(100);
}

/* ---------- reports and support ---------- */

export const reportedReviews = (db: DB) =>
	db
		.select({
			id: review.id,
			rating: review.rating,
			text: review.text,
			hidden: review.hidden,
			reportReason: review.reportReason,
			reportedAt: review.reportedAt,
			displayName: review.displayName,
			tutorName: tutorProfile.tutorName
		})
		.from(review)
		.innerJoin(tutorProfile, eq(tutorProfile.tutorId, review.tutorId))
		.where(or(isNotNull(review.reportedAt), eq(review.hidden, true)))
		.orderBy(desc(review.reportedAt));

export async function dismissReport(db: DB, id: number) {
	await db.update(review).set({ reportedAt: null, reportReason: null }).where(eq(review.id, id));
}

export const openSupport = (db: DB) =>
	db
		.select()
		.from(supportRequest)
		.orderBy(
			sql`case ${supportRequest.status} when 'open' then 0 else 1 end`,
			desc(supportRequest.createdAt)
		)
		.limit(100);

export async function closeSupport(db: DB, id: number) {
	await db.update(supportRequest).set({ status: 'done' }).where(eq(supportRequest.id, id));
}

/* ---------- the standard subjects list ---------- */

export const listPlatformSubjects = (db: DB) =>
	db.select().from(platformSubject).orderBy(platformSubject.sortOrder, platformSubject.name);

export async function addPlatformSubject(db: DB, name: string) {
	await db.insert(platformSubject).values({ name, sortOrder: 100 }).onConflictDoNothing();
}

export async function removePlatformSubject(db: DB, id: number) {
	await db.delete(platformSubject).where(eq(platformSubject.id, id));
}
