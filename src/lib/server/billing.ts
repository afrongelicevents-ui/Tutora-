import { and, asc, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import {
	charge,
	lessonPackage,
	payment,
	paymentAllocation,
	studentPackage,
	tutorProfile
} from './db/app.schema.ts';
import { user } from './db/auth.schema.ts';
import { getSettings } from './settings.ts';
import { enroll, isEnrolled } from './people.ts';

export type PaymentMethod = (typeof payment.$inferSelect)['method'];

export class BillingFail extends Error {
	constructor(public code: 'err_not_found' | 'err_state' | 'err_package') {
		super(code);
	}
}

/** Student buys a package: credits are available straight away, the price is owed. */
export async function buyPackage(db: DB, tutorId: string, userId: string, packageId: number) {
	return db.transaction(async (tx) => {
		const [p] = await tx
			.select()
			.from(lessonPackage)
			.innerJoin(tutorProfile, eq(tutorProfile.tutorId, lessonPackage.tutorId))
			.where(
				and(
					eq(lessonPackage.id, packageId),
					eq(lessonPackage.tutorId, tutorId),
					eq(lessonPackage.active, true),
					eq(tutorProfile.status, 'active')
				)
			)
			.then((rows) => rows.map((r) => r.lesson_package));
		if (!p) throw new BillingFail('err_package');
		await enroll(tx, tutorId, userId);
		const [sp] = await tx
			.insert(studentPackage)
			.values({
				tutorId,
				userId,
				packageId: p.id,
				name: p.name,
				lessonsTotal: p.lessonCount,
				priceCents: p.priceCents
			})
			.returning();
		if (p.priceCents > 0) {
			await tx.insert(charge).values({
				tutorId,
				userId,
				kind: 'package',
				studentPackageId: sp.id,
				description: `Package: ${p.name}`,
				amountCents: p.priceCents
			});
		}
		return sp;
	});
}

export interface NewPayment {
	amountCents: number;
	method: PaymentMethod;
	reference: string | null;
	paidOn: string;
	proofKey: string | null;
}

/**
 * Student records a payment to one of their tutors (with proof, or cash). Waits for that tutor.
 * Only possible for a tutor the student is enrolled with.
 */
export async function submitPayment(db: DB, tutorId: string, userId: string, p: NewPayment) {
	if (!(await isEnrolled(db, tutorId, userId))) throw new BillingFail('err_not_found');
	const s = await getSettings(db, tutorId);
	const [row] = await db
		.insert(payment)
		.values({
			tutorId,
			userId,
			...p,
			currency: s.currency,
			recordedBy: 'student',
			status: 'pending'
		})
		.returning();
	return row;
}

/**
 * Tutor confirms: gives the next receipt number (never reused) and puts the money towards
 * the oldest unpaid lessons/packages first.
 */
export async function confirmPayment(db: DB, tutorId: string, paymentId: number, now = new Date()) {
	return db.transaction(async (tx) => {
		const [p] = await tx
			.select()
			.from(payment)
			.where(and(eq(payment.id, paymentId), eq(payment.tutorId, tutorId)))
			.for('update');
		if (!p) throw new BillingFail('err_not_found');
		if (p.status !== 'pending') throw new BillingFail('err_state');
		// next receipt number of THIS tutor; the lock on their profile row makes two
		// confirmations at the same moment take turns
		await tx
			.select({ id: tutorProfile.tutorId })
			.from(tutorProfile)
			.where(eq(tutorProfile.tutorId, tutorId))
			.for('update');
		const [{ n }] = await tx
			.select({ n: sql<number>`coalesce(max(${payment.receiptNo}), 0)::int + 1` })
			.from(payment)
			.where(eq(payment.tutorId, tutorId));
		await tx
			.update(payment)
			.set({ status: 'confirmed', receiptNo: n, decidedAt: now })
			.where(eq(payment.id, p.id));

		// One confirmation at a time per student: lock their charge rows, so two payments
		// confirmed at the same moment never both cover the same lesson.
		await tx
			.select({ id: charge.id })
			.from(charge)
			.where(and(eq(charge.tutorId, tutorId), eq(charge.userId, p.userId)))
			.orderBy(asc(charge.id))
			.for('update');
		const open = await unpaidCharges(tx, tutorId, p.userId);
		let left = p.amountCents;
		for (const c of open) {
			if (left <= 0) break;
			const take = Math.min(left, c.due);
			await tx
				.insert(paymentAllocation)
				.values({ paymentId: p.id, chargeId: c.id, amountCents: take });
			left -= take;
		}
		return { ...p, status: 'confirmed' as const, receiptNo: n };
	});
}

export async function rejectPayment(
	db: DB,
	tutorId: string,
	paymentId: number,
	reason: string | null,
	now = new Date()
) {
	const [p] = await db
		.select()
		.from(payment)
		.where(and(eq(payment.id, paymentId), eq(payment.tutorId, tutorId)));
	if (!p) throw new BillingFail('err_not_found');
	if (p.status !== 'pending') throw new BillingFail('err_state');
	// only a payment that is still waiting can be rejected (never a confirmed one)
	const done = await db
		.update(payment)
		.set({ status: 'rejected', rejectReason: reason, decidedAt: now })
		.where(and(eq(payment.id, p.id), eq(payment.status, 'pending')))
		.returning({ id: payment.id });
	if (!done.length) throw new BillingFail('err_state');
	return p;
}

/** Tutor records cash they received: confirmed straight away, with a receipt. */
export async function recordCash(
	db: DB,
	tutorId: string,
	userId: string,
	amountCents: number,
	paidOn: string,
	now = new Date()
) {
	if (!(await isEnrolled(db, tutorId, userId))) throw new BillingFail('err_not_found');
	const s = await getSettings(db, tutorId);
	const [row] = await db
		.insert(payment)
		.values({
			tutorId,
			userId,
			amountCents,
			method: 'cash',
			reference: null,
			paidOn,
			proofKey: null,
			currency: s.currency,
			recordedBy: 'tutor'
		})
		.returning();
	return confirmPayment(db, tutorId, row.id, now);
}

/** Charges with money still due, oldest first. */
export async function unpaidCharges(db: DB, tutorId: string, userId: string) {
	// a plain join: amounts already put towards each charge
	const rows = await db
		.select({
			id: charge.id,
			description: charge.description,
			amountCents: charge.amountCents,
			paid: sql<number>`coalesce(sum(${paymentAllocation.amountCents}), 0)::int`
		})
		.from(charge)
		.leftJoin(paymentAllocation, eq(paymentAllocation.chargeId, charge.id))
		.where(and(eq(charge.tutorId, tutorId), eq(charge.userId, userId), eq(charge.voided, false)))
		.groupBy(charge.id)
		.orderBy(asc(charge.createdAt), asc(charge.id));
	return rows.map((r) => ({ ...r, due: r.amountCents - r.paid })).filter((r) => r.due > 0);
}

export interface Balance {
	charged: number;
	paid: number;
	waiting: number;
	/** money still owed (never negative) */
	owed: number;
	/** paid more than charged (e.g. after a cancellation) */
	credit: number;
}

export async function balanceFor(db: DB, tutorId: string, userId: string): Promise<Balance> {
	const all = await balances(db, tutorId, [userId]);
	return all.get(userId) ?? { charged: 0, paid: 0, waiting: 0, owed: 0, credit: 0 };
}

/** Money per student with ONE tutor (charges and payments of other tutors never mix in). */
export async function balances(
	db: DB,
	tutorId: string,
	userIds?: string[]
): Promise<Map<string, Balance>> {
	const whereC = and(
		eq(charge.tutorId, tutorId),
		eq(charge.voided, false),
		userIds ? inArray(charge.userId, userIds) : undefined
	);
	const whereP = and(
		eq(payment.tutorId, tutorId),
		userIds ? inArray(payment.userId, userIds) : undefined
	);
	const [cs, ps] = await Promise.all([
		db
			.select({ userId: charge.userId, total: sql<number>`sum(${charge.amountCents})::int` })
			.from(charge)
			.where(whereC)
			.groupBy(charge.userId),
		db
			.select({
				userId: payment.userId,
				paid: sql<number>`coalesce(sum(${payment.amountCents}) filter (where ${payment.status} = 'confirmed'), 0)::int`,
				waiting: sql<number>`coalesce(sum(${payment.amountCents}) filter (where ${payment.status} = 'pending'), 0)::int`
			})
			.from(payment)
			.where(whereP)
			.groupBy(payment.userId)
	]);
	const out = new Map<string, Balance>();
	const get = (id: string) =>
		out.get(id) ?? out.set(id, { charged: 0, paid: 0, waiting: 0, owed: 0, credit: 0 }).get(id)!;
	for (const c of cs) get(c.userId).charged = c.total;
	for (const p of ps) Object.assign(get(p.userId), { paid: p.paid, waiting: p.waiting });
	for (const b of out.values()) {
		b.owed = Math.max(0, b.charged - b.paid);
		b.credit = Math.max(0, b.paid - b.charged);
	}
	return out;
}

const paymentFields = {
	id: payment.id,
	tutorId: payment.tutorId,
	userId: payment.userId,
	studentName: user.name,
	amountCents: payment.amountCents,
	currency: payment.currency,
	method: payment.method,
	reference: payment.reference,
	paidOn: payment.paidOn,
	proofKey: payment.proofKey,
	status: payment.status,
	rejectReason: payment.rejectReason,
	recordedBy: payment.recordedBy,
	receiptNo: payment.receiptNo,
	createdAt: payment.createdAt,
	decidedAt: payment.decidedAt
};

/** A student's payments; with tutorId, only those to that tutor. */
export const paymentsForUser = (db: DB, userId: string, tutorId?: string) =>
	db
		.select({ ...paymentFields, tutorName: tutorProfile.tutorName })
		.from(payment)
		.innerJoin(user, eq(user.id, payment.userId))
		.leftJoin(tutorProfile, eq(tutorProfile.tutorId, payment.tutorId))
		.where(and(eq(payment.userId, userId), tutorId ? eq(payment.tutorId, tutorId) : undefined))
		.orderBy(desc(payment.createdAt));

export const pendingPayments = (db: DB, tutorId: string) =>
	db
		.select(paymentFields)
		.from(payment)
		.innerJoin(user, eq(user.id, payment.userId))
		.where(and(eq(payment.tutorId, tutorId), eq(payment.status, 'pending')))
		.orderBy(asc(payment.createdAt));

export const recentPayments = (db: DB, tutorId: string, limit = 50) =>
	db
		.select(paymentFields)
		.from(payment)
		.innerJoin(user, eq(user.id, payment.userId))
		.where(eq(payment.tutorId, tutorId))
		.orderBy(desc(payment.createdAt))
		.limit(limit);

/** One payment; with tutorId, only if it was made to that tutor. */
export async function getPayment(db: DB, id: number, tutorId?: string) {
	const [p] = await db
		.select(paymentFields)
		.from(payment)
		.innerJoin(user, eq(user.id, payment.userId))
		.where(and(eq(payment.id, id), tutorId ? eq(payment.tutorId, tutorId) : undefined));
	return p ?? null;
}

/** A student's packages; with tutorId, only that tutor's. */
export const packagesForUser = (db: DB, userId: string, tutorId?: string) =>
	db
		.select({
			id: studentPackage.id,
			tutorId: studentPackage.tutorId,
			name: studentPackage.name,
			lessonsTotal: studentPackage.lessonsTotal,
			lessonsUsed: studentPackage.lessonsUsed,
			priceCents: studentPackage.priceCents,
			createdAt: studentPackage.createdAt,
			tutorName: tutorProfile.tutorName
		})
		.from(studentPackage)
		.leftJoin(tutorProfile, eq(tutorProfile.tutorId, studentPackage.tutorId))
		.where(
			and(
				eq(studentPackage.userId, userId),
				tutorId ? eq(studentPackage.tutorId, tutorId) : undefined
			)
		)
		.orderBy(desc(studentPackage.createdAt));

/** Confirmed money per month (by the date the tutor confirmed). */
export async function monthlyTotals(db: DB, tutorId: string, from: Date) {
	return db
		.select({
			month: sql<string>`to_char(${payment.decidedAt} at time zone 'Africa/Harare', 'YYYY-MM')`,
			currency: payment.currency,
			total: sql<number>`sum(${payment.amountCents})::int`,
			count: sql<number>`count(*)::int`
		})
		.from(payment)
		.where(
			and(
				eq(payment.tutorId, tutorId),
				eq(payment.status, 'confirmed'),
				gte(payment.decidedAt, from)
			)
		)
		.groupBy(sql`1`, payment.currency)
		.orderBy(sql`1 desc`);
}

export function receiptNumber(n: number) {
	return `R-${String(n).padStart(6, '0')}`;
}

export interface ReceiptData {
	number: string;
	date: Date;
	studentName: string;
	method: PaymentMethod;
	reference: string | null;
	amountCents: number;
	currency: 'USD' | 'ZWG';
	covers: { description: string; amountCents: number }[];
	tutorName: string | null;
	tutorEmail: string | null;
}

/** Receipt contents; with tutorId, only for a payment made to that tutor. */
export async function receiptData(
	db: DB,
	paymentId: number,
	tutorId?: string
): Promise<ReceiptData | null> {
	const p = await getPayment(db, paymentId, tutorId);
	if (!p || p.status !== 'confirmed' || !p.receiptNo) return null;
	const [s, covers] = await Promise.all([
		getSettings(db, p.tutorId),
		db
			.select({ description: charge.description, amountCents: paymentAllocation.amountCents })
			.from(paymentAllocation)
			.innerJoin(charge, eq(charge.id, paymentAllocation.chargeId))
			.where(eq(paymentAllocation.paymentId, paymentId))
			.orderBy(asc(paymentAllocation.id))
	]);
	return {
		number: receiptNumber(p.receiptNo),
		date: p.decidedAt ?? p.createdAt,
		studentName: p.studentName,
		method: p.method,
		reference: p.reference,
		amountCents: p.amountCents,
		currency: p.currency,
		covers,
		tutorName: s.tutorName,
		tutorEmail: s.contactEmail
	};
}

/** CSV with a header row. Cells are quoted and protected against spreadsheet formulas. */
export function toCsv(rows: (string | number | null)[][]): string {
	const cell = (v: string | number | null) => {
		if (v === null) return '';
		let s = String(v);
		if (/^[=+\-@\t\r]/.test(s) && typeof v === 'string') s = `'${s}`;
		return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
	};
	return rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

export async function paymentsBetween(db: DB, tutorId: string, from: Date, to: Date) {
	return db
		.select(paymentFields)
		.from(payment)
		.innerJoin(user, eq(user.id, payment.userId))
		.where(
			and(eq(payment.tutorId, tutorId), gte(payment.createdAt, from), lt(payment.createdAt, to))
		)
		.orderBy(asc(payment.createdAt));
}
