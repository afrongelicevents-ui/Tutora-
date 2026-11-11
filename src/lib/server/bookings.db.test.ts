import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { freshDb, hasTestDb } from './testing/db.ts';
import { makeUser, MONDAY_8AM, zw } from './testing/fixtures.ts';
import type { DB } from './db/types.ts';
import { addPackage, addSubject, replaceAvailability, updateSettings } from './settings.ts';
import {
	acceptBooking,
	availableSlots,
	BookingFail,
	cancelLesson,
	cancelMyPlace,
	declineBooking,
	isAttendee,
	lessonsForUser,
	openGroupLessons,
	pendingRequests,
	proposeTime,
	requestBooking,
	respondToProposal,
	withdrawRequest
} from './bookings.ts';
import { addEvent } from './calendar.ts';
import { balanceFor, buyPackage } from './billing.ts';
import { attendee, booking, charge, lesson, studentPackage } from './db/app.schema.ts';

const fails = async (p: Promise<unknown>, code: string) => {
	await expect(p).rejects.toBeInstanceOf(BookingFail);
	await expect(p).rejects.toMatchObject({ code });
};

describe.skipIf(!hasTestDb)('bookings and calendar (real database)', () => {
	let db: DB;
	let close: () => Promise<void>;
	let maths: number;
	let physics: number;
	const now = MONDAY_8AM;

	beforeAll(async () => {
		({ db, close } = await freshDb());
		await updateSettings(db, {
			lessonModes: 'both',
			groupMode: 'both',
			maxGroupSize: 3,
			lessonMinutes: 60,
			cancelHours: 24,
			defaultPriceCents: 800
		});
		maths = (await addSubject(db, { name: 'Mathematics', levels: 'O Level', price: 1000 })).id;
		physics = (await addSubject(db, { name: 'Physics', levels: 'A Level', price: null })).id;
		await replaceAvailability(
			db,
			[1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMinute: 15 * 60, endMinute: 18 * 60 }))
		);
	});
	afterAll(async () => close?.());

	const lessonReq = (subjectId: number, startsAt: Date, extra = {}) => ({
		kind: 'lesson' as const,
		subjectId,
		mode: 'online' as const,
		startsAt,
		joinLessonId: null,
		note: null,
		...extra
	});

	it('only offers free times and refuses anything else', async () => {
		const s = await requestBooking(
			db,
			(await makeUser(db, 'student')).id,
			lessonReq(maths, zw(1, '15:00')),
			now
		);
		expect(s.status).toBe('requested');
		const other = await makeUser(db, 'student');
		// same time is now held by the pending request
		await fails(
			requestBooking(db, other.id, lessonReq(maths, zw(1, '15:00')), now),
			'err_slot_taken'
		);
		// not on the hour grid / outside free times / too soon
		await fails(
			requestBooking(db, other.id, lessonReq(maths, zw(1, '15:30')), now),
			'err_slot_taken'
		);
		await fails(
			requestBooking(db, other.id, lessonReq(maths, zw(1, '09:00')), now),
			'err_slot_taken'
		);
		await fails(
			requestBooking(db, other.id, lessonReq(maths, zw(0, '15:00')), now),
			'err_slot_taken'
		);
		// subject must exist and be active
		await fails(requestBooking(db, other.id, lessonReq(9999, zw(2, '15:00')), now), 'err_subject');
	});

	it("blocks the tutor's own events", async () => {
		await addEvent(db, {
			title: 'Meeting',
			startsAt: zw(2, '16:00'),
			endsAt: zw(2, '17:00'),
			note: null
		});
		const slots = (await availableSlots(db, 'lesson', now)).map((d) => d.getTime());
		expect(slots).not.toContain(zw(2, '16:00').getTime());
		expect(slots).toContain(zw(2, '15:00').getTime());
	});

	it('respects online / in person setting', async () => {
		await updateSettings(db, { lessonModes: 'online' });
		const u = await makeUser(db, 'student');
		await fails(
			requestBooking(db, u.id, lessonReq(maths, zw(2, '17:00'), { mode: 'in_person' }), now),
			'err_mode'
		);
		await updateSettings(db, { lessonModes: 'both' });
	});

	it('limits open requests per person', async () => {
		const u = await makeUser(db, 'student');
		const times = ['15:00', '16:00', '17:00'].flatMap((t) => [zw(3, t), zw(4, t)]);
		for (const t of times.slice(0, 5)) await requestBooking(db, u.id, lessonReq(maths, t), now);
		await fails(requestBooking(db, u.id, lessonReq(maths, times[5]), now), 'err_too_many_requests');
		// tidy up so later tests have free times
		const mine = await db.select().from(booking).where(eq(booking.userId, u.id));
		for (const b of mine) await withdrawRequest(db, u.id, b.id, now);
	});

	it('accepting creates the lesson and a charge at the subject price', async () => {
		const u = await makeUser(db, 'student');
		const b = await requestBooking(db, u.id, lessonReq(maths, zw(7, '15:00')), now);
		const r = await acceptBooking(db, b.id, now);
		expect(await isAttendee(db, u.id, r.lessonId)).toBe(true);
		expect((await balanceFor(db, u.id)).owed).toBe(1000);
		const [l] = await db.select().from(lesson).where(eq(lesson.id, r.lessonId));
		expect(l.capacity).toBe(3); // groups allowed
		await fails(acceptBooking(db, b.id, now), 'err_state'); // not twice
		// subject without its own price uses the default
		const u2 = await makeUser(db, 'student');
		const b2 = await requestBooking(db, u2.id, lessonReq(physics, zw(7, '16:00')), now);
		await acceptBooking(db, b2.id, now);
		expect((await balanceFor(db, u2.id)).owed).toBe(800);
	});

	it('free intro chats cost nothing and are 15 minutes', async () => {
		const u = await makeUser(db, 'parent');
		const b = await requestBooking(
			db,
			u.id,
			{ ...lessonReq(maths, zw(8, '15:00')), kind: 'intro', subjectId: null },
			now
		);
		expect(b.endsAt.getTime() - b.startsAt.getTime()).toBe(15 * 60_000);
		await acceptBooking(db, b.id, now);
		expect((await balanceFor(db, u.id)).owed).toBe(0);
	});

	it('a package credit is used instead of a charge, and given back on cancel', async () => {
		const pkg = await addPackage(db, { name: '4 lessons', lessonCount: 4, price: 2800 });
		const u = await makeUser(db, 'student');
		await buyPackage(db, u.id, pkg.id);
		expect((await balanceFor(db, u.id)).owed).toBe(2800);
		const b = await requestBooking(db, u.id, lessonReq(maths, zw(8, '17:00')), now);
		const { lessonId } = await acceptBooking(db, b.id, now);
		const [sp] = await db.select().from(studentPackage).where(eq(studentPackage.userId, u.id));
		expect(sp.lessonsUsed).toBe(1);
		expect((await balanceFor(db, u.id)).owed).toBe(2800); // no extra charge
		await cancelMyPlace(db, u.id, lessonId, now);
		const [after] = await db.select().from(studentPackage).where(eq(studentPackage.userId, u.id));
		expect(after.lessonsUsed).toBe(0);
	});

	it('students can join a group lesson until it is full', async () => {
		const first = await makeUser(db, 'student');
		const b = await requestBooking(db, first.id, lessonReq(maths, zw(9, '15:00')), now);
		const { lessonId } = await acceptBooking(db, b.id, now);
		const groups = await openGroupLessons(db, now);
		expect(groups.find((g) => g.id === lessonId)?.booked).toBe(1);
		for (let i = 0; i < 2; i++) {
			const u = await makeUser(db, 'student');
			const j = await requestBooking(
				db,
				u.id,
				lessonReq(maths, null as never, { joinLessonId: lessonId }),
				now
			);
			expect((await acceptBooking(db, j.id, now)).lessonId).toBe(lessonId);
		}
		const late = await makeUser(db, 'student');
		await fails(
			requestBooking(db, late.id, lessonReq(maths, null as never, { joinLessonId: lessonId }), now),
			'err_group_full'
		);
		// a different subject cannot join
		await fails(
			requestBooking(
				db,
				late.id,
				lessonReq(physics, null as never, { joinLessonId: lessonId }),
				now
			),
			'err_group_full'
		);
	});

	it('one-to-one only: lessons have one place', async () => {
		await updateSettings(db, { groupMode: 'one_to_one' });
		const u = await makeUser(db, 'student');
		const b = await requestBooking(db, u.id, lessonReq(maths, zw(9, '17:00')), now);
		const { lessonId } = await acceptBooking(db, b.id, now);
		const [l] = await db.select().from(lesson).where(eq(lesson.id, lessonId));
		expect(l.capacity).toBe(1);
		expect(await openGroupLessons(db, now)).toEqual([]);
		await updateSettings(db, { groupMode: 'both' });
	});

	it('decline, and suggest another time which the student accepts or refuses', async () => {
		const u = await makeUser(db, 'student');
		const b1 = await requestBooking(db, u.id, lessonReq(maths, zw(10, '15:00')), now);
		await declineBooking(db, b1.id, 'Sorry, away', now);
		expect((await pendingRequests(db)).some((r) => r.id === b1.id)).toBe(false);

		const b2 = await requestBooking(db, u.id, lessonReq(maths, zw(10, '16:00')), now);
		await proposeTime(db, b2.id, zw(10, '17:00'), 'Can we do 5pm?', now);
		const other = await makeUser(db, 'student');
		await fails(respondToProposal(db, other.id, b2.id, true, now), 'err_not_found'); // not theirs
		const r = await respondToProposal(db, u.id, b2.id, true, now);
		const [l] = await db.select().from(lesson).where(eq(lesson.id, r!.lessonId));
		expect(l.startsAt.getTime()).toBe(zw(10, '17:00').getTime());

		const b3 = await requestBooking(db, u.id, lessonReq(maths, zw(11, '15:00')), now);
		await proposeTime(db, b3.id, zw(11, '16:00'), null, now);
		expect(await respondToProposal(db, u.id, b3.id, false, now)).toBeNull();
		const [b3after] = await db.select().from(booking).where(eq(booking.id, b3.id));
		expect(b3after.status).toBe('cancelled');
	});

	it('students can cancel only up to the cancellation time, and the charge is removed', async () => {
		const u = await makeUser(db, 'student');
		const b = await requestBooking(db, u.id, lessonReq(maths, zw(14, '15:00')), now);
		const { lessonId } = await acceptBooking(db, b.id, now);
		// 23 hours before: too late
		await fails(
			cancelMyPlace(db, u.id, lessonId, new Date(zw(14, '15:00').getTime() - 23 * 3_600_000)),
			'err_cancel_late'
		);
		// someone else cannot cancel it
		const other = await makeUser(db, 'student');
		await fails(cancelMyPlace(db, other.id, lessonId, now), 'err_not_found');
		await cancelMyPlace(db, u.id, lessonId, now);
		expect((await balanceFor(db, u.id)).owed).toBe(0);
		const [l] = await db.select().from(lesson).where(eq(lesson.id, lessonId));
		expect(l.status).toBe('cancelled'); // nobody left
		expect(await lessonsForUser(db, u.id)).toEqual([]);
	});

	it('tutor cancels a lesson: everybody is released', async () => {
		const u = await makeUser(db, 'student');
		const b = await requestBooking(db, u.id, lessonReq(maths, zw(15, '15:00')), now);
		const { lessonId } = await acceptBooking(db, b.id, now);
		const r = await cancelLesson(db, lessonId);
		expect(r.userIds).toEqual([u.id]);
		const [a] = await db
			.select()
			.from(attendee)
			.where(and(eq(attendee.lessonId, lessonId), eq(attendee.userId, u.id)));
		expect(a.status).toBe('cancelled');
		const cs = await db.select().from(charge).where(eq(charge.attendeeId, a.id));
		expect(cs.every((c) => c.voided)).toBe(true);
	});

	it('students only see their own lessons', async () => {
		const a = await makeUser(db, 'student');
		const b = await makeUser(db, 'student');
		const r = await requestBooking(db, a.id, lessonReq(maths, zw(16, '15:00')), now);
		await acceptBooking(db, r.id, now);
		expect((await lessonsForUser(db, a.id)).length).toBe(1);
		expect(await lessonsForUser(db, b.id)).toEqual([]);
	});
});
