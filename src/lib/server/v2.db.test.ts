import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshDb, hasTestDb } from './testing/db.ts';
import { makeUser, MONDAY_8AM, zw } from './testing/fixtures.ts';
import type { DB } from './db/types.ts';
import {
	addSubject,
	getSettings,
	listTutors,
	replaceAvailability,
	updateSettings
} from './settings.ts';
import { acceptBooking, availableSlots, BookingFail, requestBooking } from './bookings.ts';
import { addEvent } from './calendar.ts';
import { completeness, SubmitFail, submitForApproval } from './tutor.ts';
import { setTutorStatus } from './owner.ts';
import { saveNotification } from './notify-core.ts';
import { notification, notificationPref, charge, payment } from './db/app.schema.ts';
import { user } from './db/auth.schema.ts';
import { addChild, attentionFor, deleteMyAccount, myLesson } from './student.ts';
import { answersToCheck, checkAnswer, giveHomework, handIn } from './people.ts';
import { recordCash } from './billing.ts';
import { looksLikeBot } from './bot.ts';

describe.skipIf(!hasTestDb)('v2: approval, notifications, intro chats, children, homework', () => {
	let db: DB;
	let close: () => Promise<void>;
	let T: string;
	let maths: number;
	const now = MONDAY_8AM;

	beforeAll(async () => {
		({ db, close } = await freshDb());
		T = (await makeUser(db, 'tutor', 'Approved Tutor')).id;
		await updateSettings(db, T, {
			lessonModes: 'online',
			defaultPriceCents: 1000,
			offersIntro: true
		});
		await replaceAvailability(
			db,
			T,
			[1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMinute: 15 * 60, endMinute: 18 * 60 }))
		);
		maths = (await addSubject(db, T, { name: 'Maths', levels: 'O Level', price: 1000 })).id;
	});
	afterAll(async () => close?.());

	it('a new tutor must complete the needed parts before sending the profile for approval', async () => {
		const n = (await makeUser(db, 'tutor', 'New Person')).id;
		await setTutorStatus(db, n, 'draft');
		let c = await completeness(db, await getSettings(db, n));
		expect(c.canSubmit).toBe(false);
		await expect(submitForApproval(db, n)).rejects.toBeInstanceOf(SubmitFail);
		await updateSettings(db, n, {
			headline: 'Maths help',
			bio: 'I teach maths.',
			ecocashNumber: '+263771111111'
		});
		await addSubject(db, n, { name: 'Maths', levels: '', price: null });
		await replaceAvailability(db, n, [{ weekday: 1, startMinute: 900, endMinute: 1000 }]);
		c = await completeness(db, await getSettings(db, n));
		expect(c.canSubmit).toBe(true);
		expect(c.percent).toBeGreaterThan(50);
		await submitForApproval(db, n);
		expect((await getSettings(db, n)).status).toBe('pending');
		// still not public until approved
		expect((await listTutors(db)).some((t) => t.tutorId === n)).toBe(false);
		await setTutorStatus(db, n, 'active');
		expect((await listTutors(db)).some((t) => t.tutorId === n)).toBe(true);
	});

	it('a free intro chat never creates a payment, and only if the tutor offers it', async () => {
		const s = await makeUser(db, 'student', 'Intro Kid', null);
		const [slot] = await availableSlots(db, T, 'intro', now);
		const b = await requestBooking(
			db,
			T,
			s.id,
			{
				kind: 'intro',
				subjectId: null,
				mode: 'online',
				startsAt: slot,
				joinLessonId: null,
				note: null
			},
			now
		);
		await acceptBooking(db, T, b.id, now);
		expect(await db.select().from(charge).where(eq(charge.userId, s.id))).toEqual([]);
		await updateSettings(db, T, { offersIntro: false });
		const [slot2] = await availableSlots(db, T, 'intro', now);
		await expect(
			requestBooking(
				db,
				T,
				s.id,
				{
					kind: 'intro',
					subjectId: null,
					mode: 'online',
					startsAt: slot2,
					joinLessonId: null,
					note: null
				},
				now
			)
		).rejects.toBeInstanceOf(BookingFail);
		await updateSettings(db, T, { offersIntro: true });
	});

	it('a parent books for their own child only; the lesson shows the child', async () => {
		const p = await makeUser(db, 'parent', 'Mrs Parent', null);
		const other = await makeUser(db, 'parent', 'Other Parent', null);
		const kid = await addChild(db, p.id, {
			name: 'Little One',
			level: 'Grade 7',
			schoolYear: null
		});
		const theirs = await addChild(db, other.id, {
			name: 'Not Yours',
			level: null,
			schoolYear: null
		});
		const slots = await availableSlots(db, T, 'lesson', now);
		await expect(
			requestBooking(
				db,
				T,
				p.id,
				{
					kind: 'lesson',
					subjectId: maths,
					mode: 'online',
					startsAt: slots[0],
					joinLessonId: null,
					note: null,
					childId: theirs.id
				},
				now
			)
		).rejects.toMatchObject({ code: 'err_child' });
		const b = await requestBooking(
			db,
			T,
			p.id,
			{
				kind: 'lesson',
				subjectId: maths,
				mode: 'online',
				startsAt: slots[0],
				joinLessonId: null,
				note: null,
				childId: kid.id
			},
			now
		);
		const { lessonId } = await acceptBooking(db, T, b.id, now);
		const l = await myLesson(db, p.id, lessonId);
		expect(l?.childName).toBe('Little One');
		expect(l?.payState).toBe('due');
		// another account cannot open it
		expect(await myLesson(db, other.id, lessonId)).toBeNull();
		// "Needs your attention" shows the money owed
		const att = await attentionFor(db, p.id, now);
		expect(att.some((a) => a.kind === 'owe')).toBe(true);
	});

	it('blocked days (holidays) remove those free times', async () => {
		const before = (await availableSlots(db, T, 'lesson', now)).filter(
			(s) => s >= zw(2, '00:00') && s < zw(3, '00:00')
		);
		expect(before.length).toBeGreaterThan(0);
		await addEvent(db, T, {
			title: 'Holiday',
			startsAt: zw(2, '00:00'),
			endsAt: zw(3, '00:00'),
			note: null,
			kind: 'blocked'
		});
		const after = (await availableSlots(db, T, 'lesson', now)).filter(
			(s) => s >= zw(2, '00:00') && s < zw(3, '00:00')
		);
		expect(after).toEqual([]);
	});

	it('notifications: always in the app; reminders and homework can be switched off', async () => {
		const s = await makeUser(db, 'student', 'Notified', null);
		expect(
			await saveNotification(db, s.id, 'Booked', 'Your lesson is booked', { kind: 'booking' })
		).toMatchObject({ sendEmail: true });
		await db
			.insert(notificationPref)
			.values({ userId: s.id, emailOff: true, remindersOff: true, homeworkOff: false });
		expect(
			await saveNotification(db, s.id, 'Reminder', 'Tomorrow', { kind: 'reminder' })
		).toBeNull();
		expect(await saveNotification(db, s.id, 'Homework', 'New', { kind: 'homework' })).toMatchObject(
			{ sendEmail: false }
		);
		// essential messages still email even with "email off"
		expect(
			await saveNotification(db, s.id, 'Payment', 'Confirmed', { kind: 'payment' })
		).toMatchObject({ sendEmail: true });
		const rows = await db.select().from(notification).where(eq(notification.userId, s.id));
		expect(rows.map((r) => r.title).sort()).toEqual(['Booked', 'Homework', 'Payment']);
	});

	it('the tutor checks handed-in homework (only their own)', async () => {
		const s = await makeUser(db, 'student', 'Hw Student', T);
		const other = await makeUser(db, 'tutor', 'Other Tutor');
		const hw = await giveHomework(db, T, {
			userId: s.id,
			title: 'Ex 1',
			note: null,
			dueOn: null,
			fileKey: null,
			fileName: null
		});
		const ans = await handIn(db, s.id, hw.id, { note: 'done', fileKey: null, fileName: null });
		expect((await answersToCheck(db, T)).map((a) => a.id)).toContain(ans!.id);
		expect(await checkAnswer(db, other.id, ans!.id, 'no')).toBe(false);
		expect(await checkAnswer(db, T, ans!.id, 'Good')).toBe(true);
		expect((await answersToCheck(db, T)).map((a) => a.id)).not.toContain(ans!.id);
	});

	it("deleting an account removes personal details but keeps the tutor's money records", async () => {
		const s = await makeUser(db, 'student', 'Leaving Student', T);
		await recordCash(db, T, s.id, 500, '2026-11-15');
		await deleteMyAccount(db, s.id);
		const [u] = await db.select().from(user).where(eq(user.id, s.id));
		expect(u.name).toBe('Deleted user');
		expect(u.email).not.toContain('example.com');
		expect(u.suspendedAt).not.toBeNull();
		expect(await db.select().from(payment).where(eq(payment.userId, s.id))).toHaveLength(1);
	});

	it('public forms catch simple bots', () => {
		expect(looksLikeBot({ website: 'http://spam' })).toBe(true);
		expect(looksLikeBot({ started: String(Date.now()) })).toBe(true);
		expect(looksLikeBot({ started: String(Date.now() - 5000) })).toBe(false);
	});
});
