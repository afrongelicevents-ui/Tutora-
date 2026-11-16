import { and, desc, eq, inArray, isNotNull, or, sql } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import {
	auditLog,
	booking,
	enrollment,
	payment,
	platformSubject,
	profile,
	review,
	subject,
	supportRequest,
	tutorProfile
} from './db/app.schema.ts';
import { session, user } from './db/auth.schema.ts';
import type { SiteSettings } from './settings.ts';
import { TUTOR_STATUS } from './db/app.schema.ts';
import { tutorSearch } from './owner-admin.ts';
import { forgetShared } from './cache.ts';

export type TutorStatus = SiteSettings['status'];

/**
 * Tutors on the platform (waiting first, then newest), with a few counts (owner area only).
 * Optionally one status, a search (name or email) and one page of the list.
 */
export async function allTutors(
	db: DB,
	o: { status?: string; q?: string; limit?: number; offset?: number } = {}
) {
	const st = (TUTOR_STATUS as readonly string[]).includes(o.status ?? '')
		? (o.status as TutorStatus)
		: undefined;
	const rows = await db
		.select({
			tutorId: tutorProfile.tutorId,
			slug: tutorProfile.slug,
			name: tutorProfile.tutorName,
			status: tutorProfile.status,
			accountName: user.name,
			plan: tutorProfile.plan,
			setupDone: sql<boolean>`${tutorProfile.setupDoneAt} is not null`,
			createdAt: tutorProfile.createdAt,
			approvedAt: tutorProfile.approvedAt,
			email: user.email,
			emailConfirmed: user.emailVerified
		})
		.from(tutorProfile)
		.innerJoin(user, eq(user.id, tutorProfile.tutorId))
		.where(and(st ? eq(tutorProfile.status, st) : undefined, tutorSearch(o.q)))
		.orderBy(
			sql`case ${tutorProfile.status} when 'pending' then 0 when 'active' then 1 when 'draft' then 2 when 'rejected' then 3 else 4 end`,
			desc(tutorProfile.createdAt),
			tutorProfile.tutorId
		)
		.limit(o.limit ?? 1000)
		.offset(o.offset ?? 0);
	if (!rows.length) return [];
	const ids = rows.map((r) => r.tutorId);
	// the same definitions as the Bookings and Payments pages: every booking request and
	// every payment, with how many were accepted / confirmed
	const [students, bookings, payments, subjects] = await Promise.all([
		db
			.select({ t: enrollment.tutorId, n: sql<number>`count(*)::int` })
			.from(enrollment)
			.where(inArray(enrollment.tutorId, ids))
			.groupBy(enrollment.tutorId),
		db
			.select({
				t: booking.tutorId,
				n: sql<number>`count(*)::int`,
				ok: sql<number>`count(*) filter (where ${booking.status} = 'accepted')::int`
			})
			.from(booking)
			.where(inArray(booking.tutorId, ids))
			.groupBy(booking.tutorId),
		db
			.select({
				t: payment.tutorId,
				n: sql<number>`count(*)::int`,
				ok: sql<number>`count(*) filter (where ${payment.status} = 'confirmed')::int`
			})
			.from(payment)
			.where(inArray(payment.tutorId, ids))
			.groupBy(payment.tutorId),
		db
			.select({ t: subject.tutorId, n: sql<number>`count(*)::int` })
			.from(subject)
			.where(and(inArray(subject.tutorId, ids), eq(subject.active, true)))
			.groupBy(subject.tutorId)
	]);
	const row = <T extends { t: string }>(list: T[], id: string) => list.find((x) => x.t === id);
	return rows.map((r) => ({
		...r,
		students: row(students, r.tutorId)?.n ?? 0,
		bookings: row(bookings, r.tutorId)?.n ?? 0,
		bookingsAccepted: row(bookings, r.tutorId)?.ok ?? 0,
		payments: row(payments, r.tutorId)?.n ?? 0,
		paymentsConfirmed: row(payments, r.tutorId)?.ok ?? 0,
		activeSubjects: row(subjects, r.tutorId)?.n ?? 0,
		// the same rule "Find a tutor" uses: a name and at least one subject to book
		findable: !!r.name?.trim() && (row(subjects, r.tutorId)?.n ?? 0) > 0
	}));
}

/**
 * Approve, suspend or re-activate a tutor. Suspending hides their public page, stops new
 * bookings and logs them out everywhere.
 */
export async function setTutorStatus(db: DB, tutorId: string, status: TutorStatus) {
	// a deleted account can never be made active again
	const [u] = await db.select({ email: user.email }).from(user).where(eq(user.id, tutorId));
	if (!u || (status === 'active' && u.email.endsWith('@deleted.invalid'))) return false;
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

/**
 * Can students find and book this tutor once active? The same rule as "Find a tutor": a
 * public name and at least one active subject. What is missing, for the owner's message.
 */
export async function tutorReadiness(db: DB, tutorId: string) {
	const [p] = await db
		.select({ name: tutorProfile.tutorName })
		.from(tutorProfile)
		.where(eq(tutorProfile.tutorId, tutorId));
	const [s] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(subject)
		.where(and(eq(subject.tutorId, tutorId), eq(subject.active, true)));
	const missing: ('name' | 'subjects')[] = [];
	if (!p?.name?.trim()) missing.push('name');
	if (!s?.n) missing.push('subjects');
	return { ready: missing.length === 0, missing };
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

export const recentAudit = (db: DB, limit = 200, offset = 0) =>
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
		.limit(limit)
		.offset(offset);

export async function auditCount(db: DB) {
	const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(auditLog);
	return r?.n ?? 0;
}

/** Not approved, with a reason the tutor sees; they can change their profile and send it again. */
export async function rejectTutor(db: DB, tutorId: string, reason: string) {
	const done = await db
		.update(tutorProfile)
		.set({ status: 'rejected', rejectReason: reason })
		.where(and(eq(tutorProfile.tutorId, tutorId), eq(tutorProfile.status, 'pending')))
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

/**
 * Suspend or restore a student, parent or schoolteacher account (suspended: can't log in,
 * logged out now). Tutors are suspended with setTutorStatus; the owner never here.
 */
export async function setStudentSuspended(db: DB, userId: string, suspended: boolean) {
	const done = await db
		.update(user)
		.set({ suspendedAt: suspended ? new Date() : null })
		.where(and(eq(user.id, userId), inArray(user.role, ['student', 'parent', 'schoolteacher'])))
		.returning({ id: user.id });
	if (done.length && suspended) await db.delete(session).where(eq(session.userId, userId));
	return done.length > 0;
}

/* ---------- all bookings and payments (to look into problems) ---------- */

export function allBookings(db: DB, status?: string) {
	const st = ['requested', 'accepted', 'declined', 'proposed', 'cancelled'].includes(status ?? '')
		? (status as 'requested')
		: undefined;
	return (
		db
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
			// by the lesson's date, newest first (the date shown on each row)
			.orderBy(desc(booking.startsAt), desc(booking.id))
			.limit(100)
	);
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
			handled: sql<boolean>`exists (select 1 from ${auditLog} where ${auditLog.target} = ${review.id}::text and ${auditLog.action} in ('review_hidden','review_shown','report_dismissed') and ${auditLog.createdAt} > now() - interval '30 days')`,
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
		// reported, hidden, or handled by the owner in the last 30 days (so a mis-press can be undone)
		.where(
			or(
				isNotNull(review.reportedAt),
				eq(review.hidden, true),
				sql`exists (select 1 from ${auditLog} where ${auditLog.target} = ${review.id}::text and ${auditLog.action} in ('review_hidden','review_shown','report_dismissed') and ${auditLog.createdAt} > now() - interval '30 days')`
			)
		)
		.orderBy(sql`${review.reportedAt} desc nulls last`, desc(review.id))
		.limit(100);

/** One review with its tutor, for the audit log line. */
export async function reviewLabel(db: DB, id: number) {
	const [r] = await db
		.select({ tutor: tutorProfile.tutorName, by: review.displayName, text: review.text })
		.from(review)
		.innerJoin(tutorProfile, eq(tutorProfile.tutorId, review.tutorId))
		.where(eq(review.id, id));
	return r ? `${r.tutor ?? '—'} · ${r.by ?? '—'}: “${(r.text ?? '').slice(0, 60)}”` : null;
}

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
	const r = await db
		.update(supportRequest)
		.set({ status: 'done' })
		.where(eq(supportRequest.id, id))
		.returning({ name: supportRequest.name, topic: supportRequest.topic });
	return r[0] ?? null;
}

/** Marked done by mistake: open again. */
export async function reopenSupport(db: DB, id: number) {
	const r = await db
		.update(supportRequest)
		.set({ status: 'open' })
		.where(eq(supportRequest.id, id))
		.returning({ name: supportRequest.name, topic: supportRequest.topic });
	return r[0] ?? null;
}

/* ---------- the standard subjects list ---------- */

export const listPlatformSubjects = (db: DB) =>
	db.select().from(platformSubject).orderBy(platformSubject.sortOrder, platformSubject.name);

/** Adds a subject unless one with the same name (any capitals, extra spaces) is there. */
export async function addPlatformSubject(db: DB, raw: string): Promise<'added' | 'exists'> {
	const name = raw.replace(/\s+/g, ' ').trim();
	const [dup] = await db
		.select({ id: platformSubject.id })
		.from(platformSubject)
		.where(sql`lower(trim(${platformSubject.name})) = ${name.toLowerCase()}`);
	if (dup) return 'exists';
	const r = await db
		.insert(platformSubject)
		.values({ name, sortOrder: 100 })
		.onConflictDoNothing()
		.returning({ id: platformSubject.id });
	forgetShared('subjects:');
	return r.length ? 'added' : 'exists';
}

/** Removes a subject; its name (for the log), or null when there was none. */
export async function removePlatformSubject(db: DB, id: number) {
	const r = await db
		.delete(platformSubject)
		.where(eq(platformSubject.id, id))
		.returning({ name: platformSubject.name });
	forgetShared('subjects:');
	return r[0]?.name ?? null;
}
