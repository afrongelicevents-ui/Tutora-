/**
 * Tutora admin (owner area): the overview figures and the searchable, paged lists.
 * Lists are read 25 at a time with their counts in the same round trip, so every owner page
 * stays inside the Workers free CPU budget however much data there is.
 */
import { and, desc, eq, inArray, isNotNull, isNull, or, sql, type SQL } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import {
	booking,
	child,
	enrollment,
	payment,
	review,
	supportRequest,
	tutorProfile
} from './db/app.schema.ts';
import { user } from './db/auth.schema.ts';
import { buddyBlock, buddyReport, studentCard } from './db/buddies.schema.ts';
import { familyLink, partnership, PARTNERSHIP_STATUS } from './db/v3.schema.ts';
import { usageSnapshot } from './db/usage.schema.ts';
import { meters, type Usage } from './free-limits.ts';
import { alias } from 'drizzle-orm/pg-core';

export const PER_PAGE = 25;

/** ?page= from the address (1 when missing or wrong). */
export function pageFrom(url: URL) {
	const page = Math.max(1, Math.min(10_000, Number(url.searchParams.get('page')) || 1));
	return { page, limit: PER_PAGE, offset: (page - 1) * PER_PAGE };
}

/** ?q= from the address, trimmed and short. */
export const searchFrom = (url: URL) => (url.searchParams.get('q') ?? '').trim().slice(0, 60);

/** A search word for ilike, with its wildcards escaped. */
const like = (q: string) => '%' + q.replace(/[\\%_]/g, (c) => '\\' + c) + '%';

const NOT_DELETED = sql`${user.email} not like '%@deleted.invalid'`;
const n = (q: SQL) => sql<number>`(${q})::int`;

/* ---------- overview ---------- */

/** Everything the overview shows, in one query. */
export async function overviewCounts(db: DB) {
	const [r] = await db
		.select({
			tutorsActive: n(
				sql`select count(*) from ${tutorProfile} where ${tutorProfile.status} = 'active'`
			),
			tutorsPending: n(
				sql`select count(*) from ${tutorProfile} where ${tutorProfile.status} = 'pending'`
			),
			students: n(
				sql`select count(*) from ${user} where ${user.role} = 'student' and ${NOT_DELETED}`
			),
			parents: n(
				sql`select count(*) from ${user} where ${user.role} = 'parent' and ${NOT_DELETED}`
			),
			teachers: n(
				sql`select count(*) from ${user} where ${user.role} = 'schoolteacher' and ${NOT_DELETED}`
			),
			bookingsWaiting: n(
				sql`select count(*) from ${booking} where ${booking.status} = 'requested' and ${booking.startsAt} > now()`
			),
			lessonsWeek: n(
				sql`select count(*) from ${booking} where ${booking.status} = 'accepted' and ${booking.startsAt} >= now() and ${booking.startsAt} < now() + interval '7 days'`
			),
			paymentsStale: n(
				sql`select count(*) from ${payment} where ${payment.status} = 'pending' and ${payment.createdAt} < now() - interval '7 days'`
			),
			paymentsMonth: n(
				sql`select count(*) from ${payment} where ${payment.status} = 'confirmed' and ${payment.createdAt} >= now() - interval '30 days'`
			),
			reviewsReported: n(
				sql`select count(*) from ${review} where ${review.reportedAt} is not null and not ${review.hidden}`
			),
			supportOpen: n(
				sql`select count(*) from ${supportRequest} where ${supportRequest.status} = 'open'`
			),
			checksWaiting: n(
				sql`select count(*) from ${studentCard} where ${studentCard.photoStatus} = 'pending' or (${studentCard.bioStatus} = 'pending' and ${studentCard.bio} is not null)`
			),
			buddyReports: n(
				sql`select count(*) from ${buddyReport} where ${buddyReport.status} = 'open'`
			),
			schoolPlusWaiting: n(
				sql`select count(*) from ${partnership} where ${partnership.status} in ('requested','tutor_accepted','teacher_invited','teacher_accepted')`
			),
			schoolPlusActive: n(
				sql`select count(*) from ${partnership} where ${partnership.status} = 'active'`
			),
			blocks: n(sql`select count(*) from ${buddyBlock}`),
			suspended: n(
				sql`select (select count(*) from ${user} where ${user.suspendedAt} is not null) + (select count(*) from ${tutorProfile} where ${tutorProfile.status} = 'suspended')`
			)
		})
		.from(sql`(select 1) x`);
	return r;
}

/** The newest hourly free-limits reading for a site, with its meters (or null). */
export async function latestUsage(db: DB, site: 'live' | 'test') {
	const [row] = await db
		.select({ data: usageSnapshot.data, takenAt: usageSnapshot.takenAt })
		.from(usageSnapshot)
		.where(eq(usageSnapshot.site, site))
		.orderBy(desc(usageSnapshot.takenAt))
		.limit(1);
	if (!row) return null;
	const u = row.data as Usage;
	return { at: row.takenAt, usage: u, meters: meters(u) };
}

/* ---------- people ---------- */

export const PEOPLE_ROLES = ['student', 'parent', 'schoolteacher'] as const;
export type PeopleRole = (typeof PEOPLE_ROLES)[number];
export type PeopleState = '' | 'active' | 'suspended';

/**
 * Students, parents or schoolteachers, newest first, 25 at a time: search by name or email,
 * filter by active / suspended. With what matters for each: a student's tutors and family,
 * a parent's children, a teacher's School+ partnerships.
 */
export async function peopleList(
	db: DB,
	role: PeopleRole,
	o: { q?: string; state?: PeopleState; limit?: number; offset?: number } = {}
) {
	const search = o.q?.trim();
	const base = and(
		eq(user.role, role),
		NOT_DELETED,
		search
			? or(sql`${user.name} ilike ${like(search)}`, sql`${user.email} ilike ${like(search)}`)
			: undefined
	);
	const where = and(
		base,
		o.state === 'suspended'
			? isNotNull(user.suspendedAt)
			: o.state === 'active'
				? isNull(user.suspendedAt)
				: undefined
	);
	// (written out in full: inside a subquery a bare "id" would mean the other table's)
	const me = sql.raw('"user"."id"');
	const extra =
		role === 'student'
			? sql<number>`(select count(*) from ${enrollment} where ${enrollment.userId} = ${me})::int`
			: role === 'parent'
				? sql<number>`((select count(*) from ${familyLink} where ${familyLink.parentId} = ${me}) + (select count(*) from ${child} where ${child.parentId} = ${me} and ${child.studentId} is null))::int`
				: sql<number>`(select count(*) from ${partnership} where ${partnership.teacherId} = ${me})::int`;
	const [rows, counts] = await Promise.all([
		db
			.select({
				id: user.id,
				name: user.name,
				email: user.email,
				createdAt: user.createdAt,
				suspendedAt: user.suspendedAt,
				emailConfirmed: user.emailVerified,
				extra
			})
			.from(user)
			.where(where)
			.orderBy(desc(user.createdAt), desc(user.id))
			.limit(o.limit ?? PER_PAGE)
			.offset(o.offset ?? 0),
		db
			.select({
				all: sql<number>`count(*)::int`,
				active: sql<number>`count(*) filter (where ${user.suspendedAt} is null)::int`,
				suspended: sql<number>`count(*) filter (where ${user.suspendedAt} is not null)::int`
			})
			.from(user)
			.where(base)
	]);
	const c = counts[0] ?? { all: 0, active: 0, suspended: 0 };
	return {
		rows,
		counts: c,
		total: o.state === 'suspended' ? c.suspended : o.state === 'active' ? c.active : c.all
	};
}

/* ---------- tutors ---------- */

export const TUTOR_FILTERS = ['', 'pending', 'active', 'suspended', 'draft', 'rejected'] as const;

/** How many tutors in each status (the filter chips), matching the search. */
export async function tutorCounts(db: DB, q?: string) {
	const search = q?.trim();
	const rows = await db
		.select({ status: tutorProfile.status, n: sql<number>`count(*)::int` })
		.from(tutorProfile)
		.innerJoin(user, eq(user.id, tutorProfile.tutorId))
		.where(
			search
				? or(
						sql`${tutorProfile.tutorName} ilike ${like(search)}`,
						sql`${user.name} ilike ${like(search)}`,
						sql`${user.email} ilike ${like(search)}`
					)
				: undefined
		)
		.groupBy(tutorProfile.status);
	const out: Record<string, number> = { '': 0 };
	for (const r of rows) {
		out[r.status] = r.n;
		out[''] += r.n;
	}
	return out;
}

/** The search condition for tutors, used by allTutors (owner.ts). */
export const tutorSearch = (q?: string) => {
	const search = q?.trim();
	return search
		? or(
				sql`${tutorProfile.tutorName} ilike ${like(search)}`,
				sql`${user.name} ilike ${like(search)}`,
				sql`${user.email} ilike ${like(search)}`
			)
		: undefined;
};

/* ---------- bookings ---------- */

export const BOOKING_FILTERS = [
	'',
	'requested',
	'proposed',
	'accepted',
	'declined',
	'cancelled'
] as const;
const studentU = alias(user, 'student_u');

/** Every booking, by the lesson's date, newest first; search by student or tutor name. */
export async function bookingList(
	db: DB,
	o: {
		status?: string;
		q?: string;
		when?: 'upcoming' | 'past' | '';
		limit?: number;
		offset?: number;
	} = {}
) {
	const st =
		(BOOKING_FILTERS as readonly string[]).includes(o.status ?? '') && o.status
			? (o.status as 'requested')
			: undefined;
	const search = o.q?.trim();
	const base = and(
		search
			? or(
					sql`${studentU.name} ilike ${like(search)}`,
					sql`${tutorProfile.tutorName} ilike ${like(search)}`
				)
			: undefined,
		o.when === 'upcoming'
			? sql`${booking.startsAt} >= now()`
			: o.when === 'past'
				? sql`${booking.startsAt} < now()`
				: undefined
	);
	const [rows, counts] = await Promise.all([
		db
			.select({
				id: booking.id,
				status: booking.status,
				kind: booking.kind,
				startsAt: booking.startsAt,
				createdAt: booking.createdAt,
				studentName: studentU.name,
				tutorName: tutorProfile.tutorName,
				tutorSlug: tutorProfile.slug
			})
			.from(booking)
			.innerJoin(studentU, eq(studentU.id, booking.userId))
			.innerJoin(tutorProfile, eq(tutorProfile.tutorId, booking.tutorId))
			.where(and(base, st ? eq(booking.status, st) : undefined))
			.orderBy(o.when === 'upcoming' ? booking.startsAt : desc(booking.startsAt), desc(booking.id))
			.limit(o.limit ?? PER_PAGE)
			.offset(o.offset ?? 0),
		db
			.select({ status: booking.status, n: sql<number>`count(*)::int` })
			.from(booking)
			.innerJoin(studentU, eq(studentU.id, booking.userId))
			.innerJoin(tutorProfile, eq(tutorProfile.tutorId, booking.tutorId))
			.where(base)
			.groupBy(booking.status)
	]);
	const c: Record<string, number> = { '': 0 };
	for (const r of counts) {
		c[r.status] = r.n;
		c[''] += r.n;
	}
	return { rows, counts: c, total: c[st ?? ''] ?? 0 };
}

/* ---------- payments ---------- */

export const PAYMENT_FILTERS = ['', 'pending', 'stale', 'confirmed', 'rejected'] as const;
const STALE = sql`${payment.status} = 'pending' and ${payment.createdAt} < now() - interval '7 days'`;

/** Every payment record, newest first; "stale" = reported but not confirmed after 7 days. */
export async function paymentList(
	db: DB,
	o: { status?: string; q?: string; limit?: number; offset?: number } = {}
) {
	const st = (PAYMENT_FILTERS as readonly string[]).includes(o.status ?? '')
		? (o.status ?? '')
		: '';
	const search = o.q?.trim();
	const base = search
		? or(
				sql`${studentU.name} ilike ${like(search)}`,
				sql`${tutorProfile.tutorName} ilike ${like(search)}`,
				sql`${payment.receiptNo}::text ilike ${like(search)}`
			)
		: undefined;
	const filter = st === 'stale' ? STALE : st ? eq(payment.status, st as 'pending') : undefined;
	const [rows, counts] = await Promise.all([
		db
			.select({
				id: payment.id,
				status: payment.status,
				method: payment.method,
				amountCents: payment.amountCents,
				currency: payment.currency,
				createdAt: payment.createdAt,
				receiptNo: payment.receiptNo,
				stale: sql<boolean>`(${STALE})`,
				studentName: studentU.name,
				tutorName: tutorProfile.tutorName
			})
			.from(payment)
			.innerJoin(studentU, eq(studentU.id, payment.userId))
			.innerJoin(tutorProfile, eq(tutorProfile.tutorId, payment.tutorId))
			.where(and(base, filter))
			.orderBy(desc(payment.createdAt), desc(payment.id))
			.limit(o.limit ?? PER_PAGE)
			.offset(o.offset ?? 0),
		db
			.select({
				all: sql<number>`count(*)::int`,
				pending: sql<number>`count(*) filter (where ${payment.status} = 'pending')::int`,
				stale: sql<number>`count(*) filter (where ${STALE})::int`,
				confirmed: sql<number>`count(*) filter (where ${payment.status} = 'confirmed')::int`,
				rejected: sql<number>`count(*) filter (where ${payment.status} = 'rejected')::int`
			})
			.from(payment)
			.innerJoin(studentU, eq(studentU.id, payment.userId))
			.innerJoin(tutorProfile, eq(tutorProfile.tutorId, payment.tutorId))
			.where(base)
	]);
	const c0 = counts[0] ?? { all: 0, pending: 0, stale: 0, confirmed: 0, rejected: 0 };
	const c: Record<string, number> = { ...c0, '': c0.all };
	return { rows, counts: c, total: c[st] ?? 0 };
}

/** A payment's tutor (the owner's receipt download reads it with the tutor's own rules). */
export async function paymentTutor(db: DB, id: number) {
	const [r] = await db.select({ tutorId: payment.tutorId }).from(payment).where(eq(payment.id, id));
	return r?.tutorId ?? null;
}

/* ---------- School+ ---------- */

export const SP_FILTERS = ['', 'waiting', ...PARTNERSHIP_STATUS] as const;
const WAITING = ['requested', 'tutor_accepted', 'teacher_invited', 'teacher_accepted'] as const;
const parentU = alias(user, 'parent_u');
const teacherU = alias(user, 'teacher_u');

/** Every School+ partnership, newest first, 25 at a time; "waiting" = not answered yet. */
export async function partnershipList(
	db: DB,
	o: { status?: string; limit?: number; offset?: number } = {}
) {
	const st = (SP_FILTERS as readonly string[]).includes(o.status ?? '') ? (o.status ?? '') : '';
	const filter =
		st === 'waiting'
			? inArray(partnership.status, [...WAITING])
			: st
				? eq(partnership.status, st as 'active')
				: undefined;
	const [rows, counts] = await Promise.all([
		db
			.select({
				id: partnership.id,
				status: partnership.status,
				subject: partnership.subject,
				schoolName: partnership.schoolName,
				teacherName: partnership.teacherName,
				teacherAccount: teacherU.name,
				studentName: studentU.name,
				parentName: parentU.name,
				tutorName: tutorProfile.tutorName,
				consentAt: partnership.consentAt,
				activeAt: partnership.activeAt,
				stoppedAt: partnership.stoppedAt,
				declinedBy: partnership.declinedBy,
				createdAt: partnership.createdAt
			})
			.from(partnership)
			.innerJoin(studentU, eq(studentU.id, partnership.studentId))
			.innerJoin(parentU, eq(parentU.id, partnership.parentId))
			.leftJoin(tutorProfile, eq(tutorProfile.tutorId, partnership.tutorId))
			.leftJoin(teacherU, eq(teacherU.id, partnership.teacherId))
			.where(filter)
			.orderBy(desc(partnership.createdAt), desc(partnership.id))
			.limit(o.limit ?? PER_PAGE)
			.offset(o.offset ?? 0),
		db
			.select({ status: partnership.status, n: sql<number>`count(*)::int` })
			.from(partnership)
			.groupBy(partnership.status)
	]);
	const c: Record<string, number> = { '': 0, waiting: 0 };
	for (const r of counts) {
		c[r.status] = r.n;
		c[''] += r.n;
		if ((WAITING as readonly string[]).includes(r.status)) c.waiting += r.n;
	}
	return { rows, counts: c, total: c[st] ?? 0 };
}

/* ---------- safety ---------- */

const blockerU = alias(user, 'blocker_u');
const blockedU = alias(user, 'blocked_u');

/** Study buddy blocks (who blocked whom), newest first. */
export function blockList(db: DB, limit = 50) {
	return db
		.select({
			blockerId: buddyBlock.blockerId,
			blockedId: buddyBlock.blockedId,
			blocker: blockerU.name,
			blocked: blockedU.name,
			createdAt: buddyBlock.createdAt
		})
		.from(buddyBlock)
		.innerJoin(blockerU, eq(blockerU.id, buddyBlock.blockerId))
		.innerJoin(blockedU, eq(blockedU.id, buddyBlock.blockedId))
		.orderBy(desc(buddyBlock.createdAt))
		.limit(limit);
}

/** Accounts the owner suspended: students, parents, teachers and tutors, newest first. */
export async function suspendedList(db: DB, limit = 50) {
	const [people, tutors] = await Promise.all([
		db
			.select({
				id: user.id,
				name: user.name,
				email: user.email,
				role: user.role,
				at: user.suspendedAt
			})
			.from(user)
			.where(and(isNotNull(user.suspendedAt), NOT_DELETED))
			.orderBy(desc(user.suspendedAt))
			.limit(limit),
		db
			.select({
				id: tutorProfile.tutorId,
				name: sql<string>`coalesce(${tutorProfile.tutorName}, ${user.name})`,
				email: user.email
			})
			.from(tutorProfile)
			.innerJoin(user, eq(user.id, tutorProfile.tutorId))
			.where(and(eq(tutorProfile.status, 'suspended'), NOT_DELETED))
			.limit(limit)
	]);
	return [
		...tutors.map((t) => ({ ...t, role: 'tutor' as const, at: null as Date | null })),
		...people
	];
}
