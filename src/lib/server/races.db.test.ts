import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshDb, hasTestDb } from './testing/db.ts';
import { makeUser, MONDAY_8AM, zw } from './testing/fixtures.ts';
import type { DB } from './db/types.ts';
import { addPackage, addSubject, replaceAvailability, updateSettings } from './settings.ts';
import {
	acceptBooking,
	cancelMyPlace,
	proposeTime,
	requestBooking,
	respondToProposal
} from './bookings.ts';
import { balanceFor, buyPackage, confirmPayment, rejectPayment, submitPayment } from './billing.ts';
import { lesson, paymentAllocation, studentPackage } from './db/app.schema.ts';
import { enter, poll, roomAccess } from './room.ts';

/** Double taps and parallel requests must never create money or credits out of nothing. */
describe.skipIf(!hasTestDb)('parallel requests (real database)', () => {
	let db: DB;
	let close: () => Promise<void>;
	let maths: number;
	const now = MONDAY_8AM;
	beforeAll(async () => {
		({ db, close } = await freshDb());
		await updateSettings(db, {
			lessonModes: 'both',
			groupMode: 'one_to_one',
			lessonMinutes: 60,
			cancelHours: 24
		});
		maths = (await addSubject(db, { name: 'Maths', levels: '', price: 800 })).id;
		await replaceAvailability(
			db,
			[1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMinute: 900, endMinute: 1080 }))
		);
	});
	afterAll(async () => close?.());
	const req = (t: Date) => ({
		kind: 'lesson' as const,
		subjectId: maths,
		mode: 'online' as const,
		startsAt: t,
		joinLessonId: null,
		note: null
	});

	it('accepting the same request twice at once makes one lesson and one charge', async () => {
		const u = await makeUser(db, 'student');
		const b = await requestBooking(db, u.id, req(zw(1, '15:00')), now);
		const r = await Promise.allSettled([
			acceptBooking(db, b.id, now),
			acceptBooking(db, b.id, now),
			acceptBooking(db, b.id, now)
		]);
		expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
		expect((await balanceFor(db, u.id)).owed).toBe(800);
		const ls = await db
			.select()
			.from(lesson)
			.where(eq(lesson.startsAt, zw(1, '15:00')));
		expect(ls).toHaveLength(1);
	});

	it('saying yes to a new time twice at once books once', async () => {
		const u = await makeUser(db, 'student');
		const b = await requestBooking(db, u.id, req(zw(2, '15:00')), now);
		await proposeTime(db, b.id, zw(2, '16:00'), null, now);
		const r = await Promise.allSettled([
			respondToProposal(db, u.id, b.id, true, now),
			respondToProposal(db, u.id, b.id, true, now)
		]);
		expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
		expect((await balanceFor(db, u.id)).owed).toBe(800);
	});

	it('cancelling twice at once gives one package credit back, not two', async () => {
		const pkg = await addPackage(db, { name: '4', lessonCount: 4, price: 2800 });
		const u = await makeUser(db, 'student');
		await buyPackage(db, u.id, pkg.id);
		for (const t of ['15:00', '16:00'])
			await acceptBooking(db, (await requestBooking(db, u.id, req(zw(3, t)), now)).id, now);
		const [lessonRow] = await db
			.select()
			.from(lesson)
			.where(eq(lesson.startsAt, zw(3, '15:00')));
		await Promise.allSettled([1, 2, 3, 4].map(() => cancelMyPlace(db, u.id, lessonRow.id, now)));
		const [sp] = await db.select().from(studentPackage).where(eq(studentPackage.userId, u.id));
		expect(sp.lessonsUsed).toBe(1);
	});

	it('a confirmed payment cannot be rejected, even at the same moment', async () => {
		const u = await makeUser(db, 'student');
		const p = await submitPayment(db, u.id, {
			amountCents: 500,
			method: 'ecocash',
			reference: 'x',
			paidOn: '2026-11-16',
			proofKey: null
		});
		const r = await Promise.allSettled([
			confirmPayment(db, p.id, now),
			rejectPayment(db, p.id, 'no', now)
		]);
		expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
		await expect(rejectPayment(db, p.id, 'no', now)).rejects.toThrow();
	});

	it('two payments confirmed at once never over-cover the same lesson', async () => {
		const u = await makeUser(db, 'student');
		await acceptBooking(db, (await requestBooking(db, u.id, req(zw(4, '15:00')), now)).id, now);
		const pay = () =>
			submitPayment(db, u.id, {
				amountCents: 800,
				method: 'cash',
				reference: null,
				paidOn: '2026-11-16',
				proofKey: null
			});
		const [a, b] = [await pay(), await pay()];
		await Promise.all([confirmPayment(db, a.id, now), confirmPayment(db, b.id, now)]);
		const allocs = await db.select().from(paymentAllocation);
		const forThese = allocs.filter((x) => x.paymentId === a.id || x.paymentId === b.id);
		expect(forThese, JSON.stringify(allocs)).toHaveLength(1);
		expect(forThese.reduce((s, x) => s + x.amountCents, 0)).toBe(800);
		expect(await balanceFor(db, u.id)).toMatchObject({ owed: 0, credit: 800 });
	});

	it('room: tutor needs 2FA; waiting students see nobody', async () => {
		const tutorNo2fa = { ...(await makeUser(db, 'tutor')), twoFactorEnabled: false };
		const s = await makeUser(db, 'student');
		const start = zw(0, '18:00');
		const [l] = await db
			.insert(lesson)
			.values({
				kind: 'lesson',
				mode: 'online',
				startsAt: start,
				endsAt: new Date(start.getTime() + 3_600_000)
			})
			.returning();
		const { attendee } = await import('./db/app.schema.ts');
		await db.insert(attendee).values({ lessonId: l.id, userId: s.id, priceCents: 0 });
		const at = new Date(start.getTime() - 60_000);
		expect(await roomAccess(db, tutorNo2fa, l.id, at)).toBeNull();
		await enter(db, (await roomAccess(db, s, l.id, at))!, s.id, at);
		expect((await poll(db, l.id, s.id, 0, at)).people).toEqual([]);
	});
});
