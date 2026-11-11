import { and, asc, eq, gt, gte, inArray, lt, ne, sql } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import {
	attendee,
	booking,
	calendarEvent,
	charge,
	lesson,
	studentPackage,
	subject
} from './db/app.schema.ts';
import { user } from './db/auth.schema.ts';
import { getSettings, lessonPrice, listAvailability, type SiteSettings } from './settings.ts';
import { freeSlots, INTRO_MINUTES, type Busy } from './slots.ts';
import { addMinutes, fmtDayTime } from '../tz.ts';

export type BookingError =
	| 'err_slot_taken'
	| 'err_subject'
	| 'err_mode'
	| 'err_too_many_requests'
	| 'err_not_found'
	| 'err_state'
	| 'err_cancel_late'
	| 'err_group_full';

export class BookingFail extends Error {
	constructor(public code: BookingError) {
		super(code);
	}
}

const MAX_OPEN_REQUESTS = 5;

/** Everything that blocks a time: scheduled lessons, the tutor's events, pending requests. */
export async function busyTimes(
	db: DB,
	from: Date,
	to: Date,
	exceptBookingId?: number
): Promise<Busy[]> {
	const [ls, evs, reqs] = await Promise.all([
		db
			.select({ start: lesson.startsAt, end: lesson.endsAt })
			.from(lesson)
			.where(and(eq(lesson.status, 'scheduled'), lt(lesson.startsAt, to), gt(lesson.endsAt, from))),
		db
			.select({ start: calendarEvent.startsAt, end: calendarEvent.endsAt })
			.from(calendarEvent)
			.where(and(lt(calendarEvent.startsAt, to), gt(calendarEvent.endsAt, from))),
		db
			.select({
				id: booking.id,
				start: booking.startsAt,
				end: booking.endsAt,
				p: booking.proposedStartsAt,
				status: booking.status
			})
			.from(booking)
			.where(and(inArray(booking.status, ['requested', 'proposed']), lt(booking.startsAt, to)))
	]);
	const pending: Busy[] = [];
	for (const r of reqs) {
		if (r.id === exceptBookingId) continue;
		if (r.status === 'requested') pending.push({ start: r.start, end: r.end });
		if (r.status === 'proposed' && r.p)
			pending.push({
				start: r.p,
				end: new Date(r.p.getTime() + (r.end.getTime() - r.start.getTime()))
			});
	}
	return [...ls, ...evs, ...pending];
}

export async function availableSlots(db: DB, kind: 'lesson' | 'intro', now = new Date()) {
	const s = await getSettings(db);
	const minutes = kind === 'intro' ? INTRO_MINUTES : s.lessonMinutes;
	const windows = await listAvailability(db);
	const busy = await busyTimes(db, now, addMinutes(now, 60 * 24 * 30));
	return freeSlots({ windows, minutes, busy, now });
}

/** Group lessons in the future with a free place, that students may ask to join. */
export async function openGroupLessons(db: DB, now = new Date()) {
	const s = await getSettings(db);
	if (s.groupMode === 'one_to_one') return [];
	const rows = await db
		.select({
			id: lesson.id,
			subjectId: lesson.subjectId,
			subjectName: subject.name,
			mode: lesson.mode,
			startsAt: lesson.startsAt,
			endsAt: lesson.endsAt,
			capacity: lesson.capacity,
			// a plain join + count of the places still booked
			booked: sql<number>`count(${attendee.id}) filter (where ${attendee.status} = 'booked')::int`
		})
		.from(lesson)
		.leftJoin(subject, eq(subject.id, lesson.subjectId))
		.leftJoin(attendee, eq(attendee.lessonId, lesson.id))
		.where(
			and(
				eq(lesson.status, 'scheduled'),
				eq(lesson.kind, 'lesson'),
				gt(lesson.startsAt, addMinutes(now, 60))
			)
		)
		.groupBy(lesson.id, subject.name)
		.orderBy(asc(lesson.startsAt));
	return rows.filter((r) => r.capacity > 1 && r.booked < r.capacity);
}

export interface BookingInput {
	kind: 'lesson' | 'intro';
	subjectId: number | null;
	mode: 'online' | 'in_person';
	startsAt: Date | null;
	joinLessonId: number | null;
	note: string | null;
}

function modeAllowed(s: SiteSettings, mode: 'online' | 'in_person') {
	return s.lessonModes === 'both' || s.lessonModes === mode;
}

/** A student (or parent) asks for a lesson. Every rule is checked again here on the server. */
export async function requestBooking(
	db: DB,
	userId: string,
	input: BookingInput,
	now = new Date()
) {
	const s = await getSettings(db);
	const open = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(booking)
		.where(and(eq(booking.userId, userId), inArray(booking.status, ['requested', 'proposed'])));
	if (open[0].n >= MAX_OPEN_REQUESTS) throw new BookingFail('err_too_many_requests');

	let subjectId: number | null = null;
	if (input.kind === 'lesson') {
		const [subj] = await db
			.select()
			.from(subject)
			.where(and(eq(subject.id, input.subjectId ?? -1), eq(subject.active, true)));
		if (!subj) throw new BookingFail('err_subject');
		subjectId = subj.id;
	}

	let startsAt: Date;
	let endsAt: Date;
	let mode = input.mode;
	if (input.joinLessonId) {
		const target = (await openGroupLessons(db, now)).find((l) => l.id === input.joinLessonId);
		if (!target || target.subjectId !== subjectId) throw new BookingFail('err_group_full');
		startsAt = target.startsAt;
		endsAt = target.endsAt;
		mode = target.mode;
	} else {
		if (!modeAllowed(s, mode)) throw new BookingFail('err_mode');
		if (!input.startsAt) throw new BookingFail('err_slot_taken');
		const slots = await availableSlots(db, input.kind, now);
		if (!slots.some((x) => x.getTime() === input.startsAt!.getTime()))
			throw new BookingFail('err_slot_taken');
		startsAt = input.startsAt;
		endsAt = addMinutes(startsAt, input.kind === 'intro' ? INTRO_MINUTES : s.lessonMinutes);
	}

	const [row] = await db
		.insert(booking)
		.values({
			userId,
			kind: input.kind,
			subjectId,
			mode,
			startsAt,
			endsAt,
			note: input.note,
			lessonId: input.joinLessonId ?? null
		})
		.returning();
	return row;
}

async function loadBooking(db: DB, id: number, lock = false) {
	// inside a transaction, lock the row so two clicks can't both act on it
	const q = db.select().from(booking).where(eq(booking.id, id));
	const [b] = lock ? await q.for('update') : await q;
	if (!b) throw new BookingFail('err_not_found');
	return b;
}

/**
 * Tutor accepts: creates the lesson (or adds the student to the group lesson),
 * then either uses a package credit or adds a charge. All in one transaction.
 */
export async function acceptBooking(db: DB, bookingId: number, now = new Date()) {
	return db.transaction(async (tx) => {
		const b = await loadBooking(tx, bookingId, true);
		if (b.status !== 'requested') throw new BookingFail('err_state');
		const s = await getSettings(tx);
		const [subj] = b.subjectId
			? await tx.select().from(subject).where(eq(subject.id, b.subjectId))
			: [null];

		let lessonId: number;
		if (b.lessonId) {
			// joining an existing group lesson
			const [l] = await tx.select().from(lesson).where(eq(lesson.id, b.lessonId)).for('update');
			const [{ n }] = await tx
				.select({ n: sql<number>`count(*)::int` })
				.from(attendee)
				.where(and(eq(attendee.lessonId, l.id), eq(attendee.status, 'booked')));
			if (l.status !== 'scheduled' || n >= l.capacity || l.startsAt <= now)
				throw new BookingFail('err_group_full');
			lessonId = l.id;
		} else {
			const clash = await tx
				.select({ id: lesson.id })
				.from(lesson)
				.where(
					and(
						eq(lesson.status, 'scheduled'),
						lt(lesson.startsAt, b.endsAt),
						gt(lesson.endsAt, b.startsAt)
					)
				);
			if (clash.length) throw new BookingFail('err_slot_taken');
			const capacity = b.kind === 'lesson' && s.groupMode !== 'one_to_one' ? s.maxGroupSize : 1;
			const [l] = await tx
				.insert(lesson)
				.values({
					kind: b.kind,
					subjectId: b.subjectId,
					mode: b.mode,
					startsAt: b.startsAt,
					endsAt: b.endsAt,
					capacity
				})
				.returning();
			lessonId = l.id;
		}

		const price = lessonPrice(s, subj, b.kind);
		const [a] = await tx
			.insert(attendee)
			.values({ lessonId, userId: b.userId, bookingId: b.id, priceCents: price })
			.returning();

		if (price > 0) {
			const [credit] = await tx
				.select()
				.from(studentPackage)
				.where(
					and(
						eq(studentPackage.userId, b.userId),
						lt(studentPackage.lessonsUsed, studentPackage.lessonsTotal)
					)
				)
				.orderBy(asc(studentPackage.createdAt))
				.limit(1)
				.for('update');
			if (credit) {
				await tx
					.update(studentPackage)
					.set({ lessonsUsed: credit.lessonsUsed + 1 })
					.where(eq(studentPackage.id, credit.id));
				await tx.update(attendee).set({ studentPackageId: credit.id }).where(eq(attendee.id, a.id));
			} else {
				await tx.insert(charge).values({
					userId: b.userId,
					kind: 'lesson',
					attendeeId: a.id,
					description: `${subj?.name ?? 'Lesson'}, ${fmtDayTime(b.startsAt)}`,
					amountCents: price
				});
			}
		}
		await tx
			.update(booking)
			.set({ status: 'accepted', lessonId, decidedAt: now })
			.where(eq(booking.id, b.id));
		return { lessonId, userId: b.userId, startsAt: b.startsAt };
	});
}

export async function declineBooking(
	db: DB,
	bookingId: number,
	message: string | null,
	now = new Date()
) {
	const b = await loadBooking(db, bookingId);
	if (b.status !== 'requested') throw new BookingFail('err_state');
	await db
		.update(booking)
		.set({ status: 'declined', tutorMessage: message, decidedAt: now })
		.where(eq(booking.id, b.id));
	return b;
}

/** Tutor suggests another time. The student accepts or says no. */
export async function proposeTime(
	db: DB,
	bookingId: number,
	newStart: Date,
	message: string | null,
	now = new Date()
) {
	const b = await loadBooking(db, bookingId);
	if (b.status !== 'requested' || b.lessonId) throw new BookingFail('err_state');
	if (newStart <= now) throw new BookingFail('err_slot_taken');
	const len = b.endsAt.getTime() - b.startsAt.getTime();
	const busy = await busyTimes(db, newStart, new Date(newStart.getTime() + len), b.id);
	if (busy.some((x) => x.start < new Date(newStart.getTime() + len) && x.end > newStart))
		throw new BookingFail('err_slot_taken');
	await db
		.update(booking)
		.set({ status: 'proposed', proposedStartsAt: newStart, tutorMessage: message, decidedAt: now })
		.where(eq(booking.id, b.id));
	return b;
}

export async function respondToProposal(
	db: DB,
	userId: string,
	bookingId: number,
	accept: boolean,
	now = new Date()
) {
	const b = await loadBooking(db, bookingId);
	if (b.userId !== userId) throw new BookingFail('err_not_found');
	if (b.status !== 'proposed' || !b.proposedStartsAt) throw new BookingFail('err_state');
	if (!accept) {
		await db
			.update(booking)
			.set({ status: 'cancelled', decidedAt: now })
			.where(and(eq(booking.id, b.id), eq(booking.status, 'proposed')));
		return null;
	}
	if (b.proposedStartsAt <= now) throw new BookingFail('err_slot_taken');
	const len = b.endsAt.getTime() - b.startsAt.getTime();
	// conditional: if two "yes" taps arrive together, only one moves on
	const moved = await db
		.update(booking)
		.set({
			status: 'requested',
			startsAt: b.proposedStartsAt,
			endsAt: new Date(b.proposedStartsAt.getTime() + len),
			proposedStartsAt: null
		})
		.where(and(eq(booking.id, b.id), eq(booking.status, 'proposed')))
		.returning({ id: booking.id });
	if (!moved.length) throw new BookingFail('err_state');
	return acceptBooking(db, b.id, now);
}

/** Student withdraws a request that hasn't been accepted yet. */
export async function withdrawRequest(db: DB, userId: string, bookingId: number, now = new Date()) {
	const b = await loadBooking(db, bookingId);
	if (b.userId !== userId) throw new BookingFail('err_not_found');
	if (b.status !== 'requested' && b.status !== 'proposed') throw new BookingFail('err_state');
	await db.update(booking).set({ status: 'cancelled', decidedAt: now }).where(eq(booking.id, b.id));
}

/** Undo the money side of one attendee: void the charge, or give the package credit back. */
async function releaseAttendee(tx: DB, a: typeof attendee.$inferSelect) {
	// only the request that actually flips booked -> cancelled may give money/credits back
	const done = await tx
		.update(attendee)
		.set({ status: 'cancelled' })
		.where(and(eq(attendee.id, a.id), eq(attendee.status, 'booked')))
		.returning({ id: attendee.id });
	if (!done.length) return false;
	await tx.update(charge).set({ voided: true }).where(eq(charge.attendeeId, a.id));
	if (a.studentPackageId) {
		await tx
			.update(studentPackage)
			.set({ lessonsUsed: sql`greatest(${studentPackage.lessonsUsed} - 1, 0)` })
			.where(eq(studentPackage.id, a.studentPackageId));
	}
	if (a.bookingId)
		await tx.update(booking).set({ status: 'cancelled' }).where(eq(booking.id, a.bookingId));
	return true;
}

/** Student cancels their place, only if it is at least `cancelHours` before the start. */
export async function cancelMyPlace(db: DB, userId: string, lessonId: number, now = new Date()) {
	return db.transaction(async (tx) => {
		const s = await getSettings(tx);
		const [row] = await tx
			.select({ a: attendee, l: lesson })
			.from(attendee)
			.innerJoin(lesson, eq(lesson.id, attendee.lessonId))
			.where(
				and(
					eq(attendee.lessonId, lessonId),
					eq(attendee.userId, userId),
					eq(attendee.status, 'booked')
				)
			);
		if (!row || row.l.status !== 'scheduled') throw new BookingFail('err_not_found');
		if (row.l.startsAt.getTime() - now.getTime() < s.cancelHours * 3_600_000)
			throw new BookingFail('err_cancel_late');
		if (!(await releaseAttendee(tx, row.a))) throw new BookingFail('err_not_found');
		const [{ n }] = await tx
			.select({ n: sql<number>`count(*)::int` })
			.from(attendee)
			.where(and(eq(attendee.lessonId, lessonId), eq(attendee.status, 'booked')));
		if (n === 0)
			await tx.update(lesson).set({ status: 'cancelled' }).where(eq(lesson.id, lessonId));
		return row.l;
	});
}

/** Tutor cancels a whole lesson: everyone's charge is removed / credit given back. */
export async function cancelLesson(db: DB, lessonId: number) {
	return db.transaction(async (tx) => {
		const [l] = await tx.select().from(lesson).where(eq(lesson.id, lessonId)).for('update');
		if (!l || l.status !== 'scheduled') throw new BookingFail('err_not_found');
		const as = await tx
			.select()
			.from(attendee)
			.where(and(eq(attendee.lessonId, lessonId), eq(attendee.status, 'booked')));
		const released: string[] = [];
		for (const a of as) if (await releaseAttendee(tx, a)) released.push(a.userId);
		await tx.update(lesson).set({ status: 'cancelled' }).where(eq(lesson.id, lessonId));
		return { lesson: l, userIds: released };
	});
}

/* ---------- reading ---------- */

const lessonFields = {
	id: lesson.id,
	kind: lesson.kind,
	mode: lesson.mode,
	startsAt: lesson.startsAt,
	endsAt: lesson.endsAt,
	status: lesson.status,
	capacity: lesson.capacity,
	subjectName: subject.name
};

/** A student's own lessons only. */
export function lessonsForUser(db: DB, userId: string) {
	return db
		.select({
			...lessonFields,
			attendeeStatus: attendee.status,
			packageId: attendee.studentPackageId
		})
		.from(attendee)
		.innerJoin(lesson, eq(lesson.id, attendee.lessonId))
		.leftJoin(subject, eq(subject.id, lesson.subjectId))
		.where(
			and(
				eq(attendee.userId, userId),
				eq(attendee.status, 'booked'),
				eq(lesson.status, 'scheduled')
			)
		)
		.orderBy(asc(lesson.startsAt));
}

export function requestsForUser(db: DB, userId: string) {
	return db
		.select({
			id: booking.id,
			kind: booking.kind,
			mode: booking.mode,
			startsAt: booking.startsAt,
			status: booking.status,
			proposedStartsAt: booking.proposedStartsAt,
			tutorMessage: booking.tutorMessage,
			subjectName: subject.name
		})
		.from(booking)
		.leftJoin(subject, eq(subject.id, booking.subjectId))
		.where(
			and(
				eq(booking.userId, userId),
				inArray(booking.status, ['requested', 'proposed', 'declined'])
			)
		)
		.orderBy(asc(booking.startsAt));
}

export function pendingRequests(db: DB) {
	return db
		.select({
			id: booking.id,
			kind: booking.kind,
			mode: booking.mode,
			startsAt: booking.startsAt,
			endsAt: booking.endsAt,
			note: booking.note,
			joinLessonId: booking.lessonId,
			userId: booking.userId,
			studentName: user.name,
			subjectName: subject.name
		})
		.from(booking)
		.innerJoin(user, eq(user.id, booking.userId))
		.leftJoin(subject, eq(subject.id, booking.subjectId))
		.where(eq(booking.status, 'requested'))
		.orderBy(asc(booking.startsAt));
}

/** Lessons in a time range with who is booked (for the tutor's calendar and Today screen). */
export async function lessonsBetween(db: DB, from: Date, to: Date) {
	const ls = await db
		.select(lessonFields)
		.from(lesson)
		.leftJoin(subject, eq(subject.id, lesson.subjectId))
		.where(and(eq(lesson.status, 'scheduled'), gte(lesson.startsAt, from), lt(lesson.startsAt, to)))
		.orderBy(asc(lesson.startsAt));
	if (!ls.length) return [];
	const people = await db
		.select({ lessonId: attendee.lessonId, userId: attendee.userId, name: user.name })
		.from(attendee)
		.innerJoin(user, eq(user.id, attendee.userId))
		.where(
			and(
				inArray(
					attendee.lessonId,
					ls.map((l) => l.id)
				),
				eq(attendee.status, 'booked')
			)
		);
	return ls.map((l) => ({ ...l, people: people.filter((p) => p.lessonId === l.id) }));
}

export async function lessonWithPeople(db: DB, lessonId: number) {
	const [l] = await db
		.select(lessonFields)
		.from(lesson)
		.leftJoin(subject, eq(subject.id, lesson.subjectId))
		.where(eq(lesson.id, lessonId));
	if (!l) return null;
	const people = await db
		.select({
			attendeeId: attendee.id,
			userId: attendee.userId,
			name: user.name,
			email: user.email,
			note: attendee.privateNote
		})
		.from(attendee)
		.innerJoin(user, eq(user.id, attendee.userId))
		.where(and(eq(attendee.lessonId, lessonId), ne(attendee.status, 'cancelled')));
	return { ...l, people };
}

/** Is this user booked on this lesson? (lesson room, .ics, files) */
export async function isAttendee(db: DB, userId: string, lessonId: number) {
	const r = await db
		.select({ id: attendee.id })
		.from(attendee)
		.where(
			and(
				eq(attendee.lessonId, lessonId),
				eq(attendee.userId, userId),
				eq(attendee.status, 'booked')
			)
		);
	return r.length > 0;
}
