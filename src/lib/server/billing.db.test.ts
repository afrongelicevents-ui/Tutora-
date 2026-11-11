import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshDb, hasTestDb } from './testing/db.ts';
import { makeUser, MONDAY_8AM, zw } from './testing/fixtures.ts';
import type { DB } from './db/types.ts';
import { addPackage, addSubject, replaceAvailability, updateSettings } from './settings.ts';
import { acceptBooking, cancelMyPlace, lessonsForUser, requestBooking } from './bookings.ts';
import {
	balanceFor,
	balances,
	BillingFail,
	buyPackage,
	confirmPayment,
	monthlyTotals,
	paymentsForUser,
	pendingPayments,
	receiptData,
	recordCash,
	rejectPayment,
	submitPayment
} from './billing.ts';
import { receiptPdf } from './pdf.ts';
import { payment, studentPackage } from './db/app.schema.ts';

describe.skipIf(!hasTestDb)('payments, receipts and packages (real database)', () => {
	let db: DB;
	let tid: string;
	let close: () => Promise<void>;
	let maths: number;
	const now = MONDAY_8AM;
	const pay = (amountCents: number, method: 'ecocash' | 'cash' | 'bank' = 'ecocash') => ({
		amountCents,
		method,
		reference: method === 'cash' ? null : 'MP123',
		paidOn: '2026-11-16',
		proofKey: method === 'cash' ? null : 'proofs/x.jpg'
	});

	beforeAll(async () => {
		({ db, close } = await freshDb());
		tid = (await makeUser(db, 'tutor', 'Tutor One')).id;
		await updateSettings(db, tid, {
			tutorName: 'Mr Test',
			contactEmail: 'tutor@example.com',
			lessonModes: 'both',
			groupMode: 'one_to_one',
			lessonMinutes: 60,
			cancelHours: 24
		});
		maths = (await addSubject(db, tid, { name: 'Maths', levels: '', price: 800 })).id;
		await replaceAvailability(
			db,
			tid,
			[1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMinute: 15 * 60, endMinute: 18 * 60 }))
		);
	});
	afterAll(async () => close?.());

	async function bookLessons(userId: string, times: Date[]) {
		for (const t of times) {
			const b = await requestBooking(
				db,
				tid,
				userId,
				{
					kind: 'lesson',
					subjectId: maths,
					mode: 'online',
					startsAt: t,
					joinLessonId: null,
					note: null
				},
				now
			);
			await acceptBooking(db, tid, b.id, now);
		}
	}

	it('proof upload waits for the tutor, then confirm gives a receipt and reduces what is owed', async () => {
		const u = await makeUser(db, 'student', 'Rudo Moyo');
		await bookLessons(u.id, [zw(1, '15:00'), zw(2, '15:00')]);
		expect(await balanceFor(db, tid, u.id)).toMatchObject({ owed: 1600, paid: 0, waiting: 0 });

		const p = await submitPayment(db, tid, u.id, pay(800));
		expect(p.status).toBe('pending');
		expect(await balanceFor(db, tid, u.id)).toMatchObject({ owed: 1600, waiting: 800 });
		expect((await pendingPayments(db, tid)).map((x) => x.id)).toContain(p.id);

		const c = await confirmPayment(db, tid, p.id, now);
		expect(c.receiptNo).toBeGreaterThan(0);
		expect(await balanceFor(db, tid, u.id)).toMatchObject({ owed: 800, paid: 800, waiting: 0 });

		// receipt covers the OLDEST lesson first
		const r = await receiptData(db, p.id);
		expect(r).toMatchObject({
			studentName: 'Rudo Moyo',
			amountCents: 800,
			method: 'ecocash',
			reference: 'MP123',
			tutorName: 'Mr Test'
		});
		expect(r!.number).toMatch(/^R-\d{6}$/);
		expect(r!.covers).toHaveLength(1);
		expect(r!.covers[0].description).toContain('Maths');
		expect(r!.covers[0].description).toContain('17 Nov');

		const pdf = await receiptPdf(r!);
		expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe('%PDF-');
		expect(pdf.length).toBeLessThan(20_000);
	});

	it('cannot confirm or reject twice', async () => {
		const u = await makeUser(db, 'student');
		const p = await submitPayment(db, tid, u.id, pay(500));
		await confirmPayment(db, tid, p.id, now);
		await expect(confirmPayment(db, tid, p.id, now)).rejects.toBeInstanceOf(BillingFail);
		await expect(rejectPayment(db, tid, p.id, 'no', now)).rejects.toBeInstanceOf(BillingFail);
	});

	it('reject keeps the reason and gives no receipt', async () => {
		const u = await makeUser(db, 'student');
		const p = await submitPayment(db, tid, u.id, pay(800));
		await rejectPayment(db, tid, p.id, 'Reference not found', now);
		const [row] = await db.select().from(payment).where(eq(payment.id, p.id));
		expect(row).toMatchObject({
			status: 'rejected',
			rejectReason: 'Reference not found',
			receiptNo: null
		});
		expect(await receiptData(db, p.id)).toBeNull();
		expect((await balanceFor(db, tid, u.id)).waiting).toBe(0);
	});

	it('receipt numbers go up and are never reused', async () => {
		const u = await makeUser(db, 'student');
		const ids = [];
		for (let i = 0; i < 3; i++) ids.push((await submitPayment(db, tid, u.id, pay(100 + i))).id);
		await rejectPayment(db, tid, ids[1], null, now);
		const a = await confirmPayment(db, tid, ids[0], now);
		const c = await confirmPayment(db, tid, ids[2], now);
		expect(c.receiptNo).toBe(a.receiptNo + 1);
		// parallel confirmations never get the same number
		const more = await Promise.all(
			[0, 1, 2, 3].map(async () => (await submitPayment(db, tid, u.id, pay(100))).id)
		);
		const nums = await Promise.all(
			more.map((id) => confirmPayment(db, tid, id, now).then((r) => r.receiptNo))
		);
		expect(new Set(nums).size).toBe(4);
	});

	it('student "I paid cash" waits; tutor-recorded cash is confirmed at once', async () => {
		const u = await makeUser(db, 'parent');
		await bookLessons(u.id, [zw(3, '15:00')]);
		const mine = await submitPayment(db, tid, u.id, pay(800, 'cash'));
		expect(mine.status).toBe('pending');
		await rejectPayment(db, tid, mine.id, 'Did not receive it', now);
		const r = await recordCash(db, tid, u.id, 800, '2026-11-16', now);
		expect(r.status).toBe('confirmed');
		expect(await balanceFor(db, tid, u.id)).toMatchObject({ owed: 0, paid: 800 });
		const [row] = await db.select().from(payment).where(eq(payment.id, r.id));
		expect(row.recordedBy).toBe('tutor');
	});

	it('packages: price is owed, lessons count down, balance shows the rest', async () => {
		const pkg = await addPackage(db, tid, { name: '4 lessons', lessonCount: 4, price: 2800 });
		const u = await makeUser(db, 'student');
		await buyPackage(db, tid, u.id, pkg.id);
		await bookLessons(u.id, [zw(7, '15:00'), zw(7, '16:00'), zw(7, '17:00')]);
		const [sp] = await db.select().from(studentPackage).where(eq(studentPackage.userId, u.id));
		expect(sp.lessonsTotal - sp.lessonsUsed).toBe(1);
		expect((await balanceFor(db, tid, u.id)).owed).toBe(2800);
		const p = await submitPayment(db, tid, u.id, pay(2800));
		await confirmPayment(db, tid, p.id, now);
		expect((await balanceFor(db, tid, u.id)).owed).toBe(0);
		expect((await receiptData(db, p.id))!.covers[0].description).toBe('Package: 4 lessons');
		// 5th lesson after the package runs out is charged normally
		await bookLessons(u.id, [zw(8, '15:00'), zw(8, '16:00')]);
		expect((await balanceFor(db, tid, u.id)).owed).toBe(800);
	});

	it('paying for a lesson that is later cancelled leaves a credit, not a debt', async () => {
		const u = await makeUser(db, 'student');
		await bookLessons(u.id, [zw(9, '15:00')]);
		const p = await submitPayment(db, tid, u.id, pay(800));
		await confirmPayment(db, tid, p.id, now);
		const ls = await lessonsForUser(db, u.id);
		await cancelMyPlace(db, u.id, ls[0].id, now);
		expect(await balanceFor(db, tid, u.id)).toMatchObject({ owed: 0, credit: 800 });
	});

	it('per-student totals and monthly totals for the tutor', async () => {
		const all = await balances(db, tid);
		expect(all.size).toBeGreaterThan(3);
		const months = await monthlyTotals(db, tid, new Date('2026-01-01'));
		expect(months[0].month).toBe('2026-11');
		expect(months[0].total).toBeGreaterThan(0);
	});

	it('students only see their own payments', async () => {
		const a = await makeUser(db, 'student');
		const b = await makeUser(db, 'student');
		await submitPayment(db, tid, a.id, pay(100));
		expect((await paymentsForUser(db, a.id)).length).toBe(1);
		expect(await paymentsForUser(db, b.id)).toEqual([]);
	});
});
