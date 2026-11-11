import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshDb, hasTestDb } from './testing/db.ts';
import { makeUser, MONDAY_8AM, zw } from './testing/fixtures.ts';
import type { DB } from './db/types.ts';
import {
	activeTutorBySlug,
	addPackage,
	addSubject,
	getSettings,
	listSubjects,
	listTutors,
	removeSubject,
	replaceAvailability,
	updateSettings
} from './settings.ts';
import {
	acceptBooking,
	BookingFail,
	cancelLesson,
	declineBooking,
	lessonWithPeople,
	pendingRequests,
	proposeTime,
	requestBooking
} from './bookings.ts';
import {
	balances,
	BillingFail,
	buyPackage,
	confirmPayment,
	getPayment,
	pendingPayments,
	recordCash,
	rejectPayment,
	submitPayment
} from './billing.ts';
import {
	enroll,
	getStudent,
	giveFeedback,
	giveHomework,
	handIn,
	listStudents,
	setPrivateNote,
	setReviewHidden,
	studentLessons,
	tutorsForUser
} from './people.ts';
import { addEvent, eventsBetween, removeEvent } from './calendar.ts';
import { setTutorStatus } from './owner.ts';
import { attendee, homeworkAnswer, review } from './db/app.schema.ts';

/**
 * Two tutors on one platform. Everything one tutor (or their student) does must never
 * reach the other tutor's data.
 */
describe.skipIf(!hasTestDb)('many tutors: every tutor only sees their own data', () => {
	let db: DB;
	let close: () => Promise<void>;
	let A: string;
	let B: string;
	let aMaths: number;
	let bEnglish: number;
	const now = MONDAY_8AM;

	beforeAll(async () => {
		({ db, close } = await freshDb());
		A = (await makeUser(db, 'tutor', 'Alice Tutor')).id;
		B = (await makeUser(db, 'tutor', 'Bongani Tutor')).id;
		for (const t of [A, B]) {
			await updateSettings(db, t, { lessonModes: 'both', defaultPriceCents: 1000 });
			await replaceAvailability(
				db,
				t,
				[1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMinute: 15 * 60, endMinute: 18 * 60 }))
			);
		}
		aMaths = (await addSubject(db, A, { name: 'Maths', levels: '', price: 1000 })).id;
		bEnglish = (await addSubject(db, B, { name: 'English', levels: '', price: 800 })).id;
	});
	afterAll(async () => close?.());

	const req = (subjectId: number, startsAt: Date) => ({
		kind: 'lesson' as const,
		subjectId,
		mode: 'online' as const,
		startsAt,
		joinLessonId: null,
		note: null
	});
	const notFound = async (p: Promise<unknown>) => {
		await expect(p).rejects.toSatisfy(
			(e) => (e instanceof BookingFail || e instanceof BillingFail) && e.code === 'err_not_found'
		);
	};

	it('each tutor has their own page address and settings', async () => {
		const a = await getSettings(db, A);
		const b = await getSettings(db, B);
		expect(a.slug).toBe('alice-tutor');
		expect(b.slug).toBe('bongani-tutor');
		expect((await activeTutorBySlug(db, 'alice-tutor'))?.tutorId).toBe(A);
		expect((await listSubjects(db, A)).map((s) => s.name)).toEqual(['Maths']);
		// B cannot hide A's subject
		await removeSubject(db, B, aMaths);
		expect((await listSubjects(db, A)).map((s) => s.name)).toEqual(['Maths']);
	});

	it('a booking with tutor A is invisible to tutor B, who cannot act on it', async () => {
		const s = await makeUser(db, 'student', 'Sam', null);
		// a subject of the other tutor cannot be booked through this tutor
		await expect(
			requestBooking(db, B, s.id, req(aMaths, zw(1, '15:00')), now)
		).rejects.toMatchObject({ code: 'err_subject' });
		const b = await requestBooking(db, A, s.id, req(aMaths, zw(1, '15:00')), now);
		// booking enrolled the student with A only
		expect((await tutorsForUser(db, s.id)).map((t) => t.tutorId)).toEqual([A]);
		expect((await pendingRequests(db, A)).map((r) => r.id)).toContain(b.id);
		expect(await pendingRequests(db, B)).toEqual([]);
		await notFound(acceptBooking(db, B, b.id, now));
		await notFound(declineBooking(db, B, b.id, null, now));
		await notFound(proposeTime(db, B, b.id, zw(2, '15:00'), null, now));
		const { lessonId } = await acceptBooking(db, A, b.id, now);
		expect(await lessonWithPeople(db, lessonId, B)).toBeNull();
		expect((await lessonWithPeople(db, lessonId, A))?.people).toHaveLength(1);
		await notFound(cancelLesson(db, B, lessonId));
		// B cannot write a private note on A's lesson
		const [a] = await db.select().from(attendee).where(eq(attendee.lessonId, lessonId));
		await setPrivateNote(db, B, a.id, 'sneaky');
		expect(
			(await db.select().from(attendee).where(eq(attendee.id, a.id)))[0].privateNote
		).toBeNull();
		expect(await studentLessons(db, B, s.id)).toEqual([]);
	});

	it("tutor B never sees tutor A's students, and A's students are not B's", async () => {
		const s = await makeUser(db, 'student', 'Only A', A);
		expect((await listStudents(db, A)).some((x) => x.id === s.id)).toBe(true);
		expect((await listStudents(db, B)).some((x) => x.id === s.id)).toBe(false);
		expect(await getStudent(db, B, s.id)).toBeNull();
	});

	it('money is kept per tutor: payments, confirmations and balances never mix', async () => {
		const s = await makeUser(db, 'student', 'Pays Both', A);
		await enroll(db, B, s.id);
		const pa = await submitPayment(db, A, s.id, {
			amountCents: 1000,
			method: 'ecocash',
			reference: 'REF1',
			paidOn: '2026-11-15',
			proofKey: null
		});
		expect((await pendingPayments(db, B)).some((p) => p.id === pa.id)).toBe(false);
		expect(await getPayment(db, pa.id, B)).toBeNull();
		await expect(confirmPayment(db, B, pa.id)).rejects.toMatchObject({ code: 'err_not_found' });
		await expect(rejectPayment(db, B, pa.id, null)).rejects.toMatchObject({
			code: 'err_not_found'
		});
		await confirmPayment(db, A, pa.id);
		await recordCash(db, B, s.id, 500, '2026-11-15');
		const ba = (await balances(db, A, [s.id])).get(s.id)!;
		const bb = (await balances(db, B, [s.id])).get(s.id)!;
		expect(ba.paid).toBe(1000);
		expect(bb.paid).toBe(500);
		// a student cannot pay (or record cash for) a tutor they are not linked to
		const stranger = await makeUser(db, 'student', 'Stranger', null);
		await expect(
			submitPayment(db, A, stranger.id, {
				amountCents: 100,
				method: 'cash',
				reference: null,
				paidOn: '2026-11-15',
				proofKey: null
			})
		).rejects.toMatchObject({ code: 'err_not_found' });
		await expect(recordCash(db, A, stranger.id, 100, '2026-11-15')).rejects.toMatchObject({
			code: 'err_not_found'
		});
	});

	it('a package can only be bought from the tutor who offers it', async () => {
		const s = await makeUser(db, 'student', 'Buyer', A);
		const p = await addPackage(db, A, { name: '5 lessons', lessonCount: 5, price: 4500 });
		await expect(buyPackage(db, B, s.id, p.id)).rejects.toMatchObject({ code: 'err_package' });
		expect((await buyPackage(db, A, s.id, p.id)).tutorId).toBe(A);
	});

	it('homework, feedback, reviews and calendar entries stay with their tutor', async () => {
		const s = await makeUser(db, 'student', 'Learner', A);
		const hw = await giveHomework(db, A, {
			userId: s.id,
			title: 'Ex 1',
			note: null,
			dueOn: null,
			fileKey: null,
			fileName: null
		});
		const ans = await handIn(db, s.id, hw.id, { note: 'done', fileKey: null, fileName: null });
		await giveFeedback(db, B, ans!.id, 'from the wrong tutor');
		expect(
			(await db.select().from(homeworkAnswer).where(eq(homeworkAnswer.id, ans!.id)))[0].feedback
		).toBeNull();
		const [r] = await db
			.insert(review)
			.values({ tutorId: A, userId: s.id, displayName: 'L', rating: 5, text: 'Great' })
			.returning();
		await setReviewHidden(db, B, r.id, true);
		expect((await db.select().from(review).where(eq(review.id, r.id)))[0].hidden).toBe(false);
		const ev = await addEvent(db, A, {
			title: 'Meeting',
			startsAt: zw(2, '09:00'),
			endsAt: zw(2, '10:00'),
			note: null
		});
		expect(await eventsBetween(db, B, zw(0, '00:00'), zw(7, '00:00'))).toEqual([]);
		await removeEvent(db, B, ev.id);
		expect(await eventsBetween(db, A, zw(0, '00:00'), zw(7, '00:00'))).toHaveLength(1);
	});

	it('pending and suspended tutors have no public page and take no bookings', async () => {
		const p = await makeUser(db, 'tutor', 'New Tutor');
		await setTutorStatus(db, p.id, 'pending');
		await addSubject(db, p.id, { name: 'Chemistry', levels: '', price: 500 });
		expect(await activeTutorBySlug(db, 'new-tutor')).toBeNull();
		expect((await listTutors(db)).some((t) => t.slug === 'new-tutor')).toBe(false);
		const s = await makeUser(db, 'student', 'Eager', null);
		const [chem] = await listSubjects(db, p.id);
		await notFound(requestBooking(db, p.id, s.id, req(chem.id, zw(1, '16:00')), now));
		await setTutorStatus(db, p.id, 'active');
		expect((await listTutors(db, 'chem')).map((t) => t.slug)).toEqual(['new-tutor']);
		await setTutorStatus(db, p.id, 'suspended');
		expect(await activeTutorBySlug(db, 'new-tutor')).toBeNull();
		expect(await listTutors(db, 'chem')).toEqual([]);
	});

	it('page addresses are unique and safe', async () => {
		const x = await makeUser(db, 'tutor', 'Alice Tutor');
		expect((await getSettings(db, x.id)).slug).toBe('alice-tutor-2');
		const y = await makeUser(db, 'tutor', 'Owner');
		expect((await getSettings(db, y.id)).slug).toBe('owner-2');
		expect(await activeTutorBySlug(db, '../alice')).toBeNull();
	});

	it('B cannot book a subject of A through B', async () => {
		const s = await makeUser(db, 'student', 'Mixer', null);
		await expect(
			requestBooking(db, A, s.id, req(bEnglish, zw(3, '15:00')), now)
		).rejects.toMatchObject({ code: 'err_subject' });
	});
});
