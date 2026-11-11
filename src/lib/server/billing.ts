import { and, asc, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import {
	charge,
	lessonPackage,
	payment,
	paymentAllocation,
	receiptSeq,
	studentPackage
} from './db/app.schema.ts';
import { user } from './db/auth.schema.ts';
import { getSettings } from './settings.ts';

export type PaymentMethod = (typeof payment.$inferSelect)['method'];

export class BillingFail extends Error {
	constructor(public code: 'err_not_found' | 'err_state' | 'err_package') {
		super(code);
	}
}

/** Student buys a package: credits are available straight away, the price is owed. */
export async function buyPackage(db: DB, userId: string, packageId: number) {
	return db.transaction(async (tx) => {
		const [p] = await tx
			.select()
			.from(lessonPackage)
			.where(and(eq(lessonPackage.id, packageId), eq(lessonPackage.active, true)));
		if (!p) throw new BillingFail('err_package');
		const [sp] = await tx
			.insert(studentPackage)
			.values({
				userId,
				packageId: p.id,
				name: p.name,
				lessonsTotal: p.lessonCount,
				priceCents: p.priceCents
			})
			.returning();
		if (p.priceCents > 0) {
			await tx.insert(charge).values({
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

/** Student records a payment (into the account with proof, or cash). Waits for the tutor. */
export async function submitPayment(db: DB, userId: string, p: NewPayment) {
	const s = await getSettings(db);
	const [row] = await db
		.insert(payment)
		.values({ userId, ...p, currency: s.currency, recordedBy: 'student', status: 'pending' })
		.returning();
	return row;
}

/**
 * Tutor confirms: gives the next receipt number (never reused) and puts the money towards
 * the oldest unpaid lessons/packages first.
 */
export async function confirmPayment(db: DB, paymentId: number, now = new Date()) {
	return db.transaction(async (tx) => {
		const [p] = await tx.select().from(payment).where(eq(payment.id, paymentId)).for('update');
		if (!p) throw new BillingFail('err_not_found');
		if (p.status !== 'pending') throw new BillingFail('err_state');
		const seq = (await tx.execute(
			sql.raw(`select nextval('${receiptSeq.seqName}')::int as n`)
		)) as unknown as { rows: { n: number }[] };
		const n = Number(seq.rows[0].n);
		await tx
			.update(payment)
			.set({ status: 'confirmed', receiptNo: n, decidedAt: now })
			.where(eq(payment.id, p.id));

		const open = await unpaidCharges(tx, p.userId);
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
	paymentId: number,
	reason: string | null,
	now = new Date()
) {
	const [p] = await db.select().from(payment).where(eq(payment.id, paymentId));
	if (!p) throw new BillingFail('err_not_found');
	if (p.status !== 'pending') throw new BillingFail('err_state');
	await db
		.update(payment)
		.set({ status: 'rejected', rejectReason: reason, decidedAt: now })
		.where(eq(payment.id, p.id));
	return p;
}

/** Tutor records cash they received: confirmed straight away, with a receipt. */
export async function recordCash(
	db: DB,
	userId: string,
	amountCents: number,
	paidOn: string,
	now = new Date()
) {
	const s = await getSettings(db);
	const [row] = await db
		.insert(payment)
		.values({
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
	return confirmPayment(db, row.id, now);
}

/** Charges with money still due, oldest first. */
export async function unpaidCharges(db: DB, userId: string) {
	const rows = await db
		.select({
			id: charge.id,
			description: charge.description,
			amountCents: charge.amountCents,
			paid: sql<number>`coalesce((select sum(pa.amount_cents)::int from ${paymentAllocation} pa where pa.charge_id = ${charge.id}), 0)`
		})
		.from(charge)
		.where(and(eq(charge.userId, userId), eq(charge.voided, false)))
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

export async function balanceFor(db: DB, userId: string): Promise<Balance> {
	const all = await balances(db, [userId]);
	return all.get(userId) ?? { charged: 0, paid: 0, waiting: 0, owed: 0, credit: 0 };
}

export async function balances(db: DB, userIds?: string[]): Promise<Map<string, Balance>> {
	const whereC = userIds
		? and(eq(charge.voided, false), inArray(charge.userId, userIds))
		: eq(charge.voided, false);
	const whereP = userIds ? inArray(payment.userId, userIds) : undefined;
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

export const paymentsForUser = (db: DB, userId: string) =>
	db
		.select(paymentFields)
		.from(payment)
		.innerJoin(user, eq(user.id, payment.userId))
		.where(eq(payment.userId, userId))
		.orderBy(desc(payment.createdAt));

export const pendingPayments = (db: DB) =>
	db
		.select(paymentFields)
		.from(payment)
		.innerJoin(user, eq(user.id, payment.userId))
		.where(eq(payment.status, 'pending'))
		.orderBy(asc(payment.createdAt));

export const recentPayments = (db: DB, limit = 50) =>
	db
		.select(paymentFields)
		.from(payment)
		.innerJoin(user, eq(user.id, payment.userId))
		.orderBy(desc(payment.createdAt))
		.limit(limit);

export async function getPayment(db: DB, id: number) {
	const [p] = await db
		.select(paymentFields)
		.from(payment)
		.innerJoin(user, eq(user.id, payment.userId))
		.where(eq(payment.id, id));
	return p ?? null;
}

export const packagesForUser = (db: DB, userId: string) =>
	db
		.select()
		.from(studentPackage)
		.where(eq(studentPackage.userId, userId))
		.orderBy(desc(studentPackage.createdAt));

/** Confirmed money per month (by the date the tutor confirmed). */
export async function monthlyTotals(db: DB, from: Date) {
	return db
		.select({
			month: sql<string>`to_char(${payment.decidedAt} at time zone 'Africa/Harare', 'YYYY-MM')`,
			currency: payment.currency,
			total: sql<number>`sum(${payment.amountCents})::int`,
			count: sql<number>`count(*)::int`
		})
		.from(payment)
		.where(and(eq(payment.status, 'confirmed'), gte(payment.decidedAt, from)))
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

export async function receiptData(db: DB, paymentId: number): Promise<ReceiptData | null> {
	const p = await getPayment(db, paymentId);
	if (!p || p.status !== 'confirmed' || !p.receiptNo) return null;
	const [s, covers] = await Promise.all([
		getSettings(db),
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

export async function paymentsBetween(db: DB, from: Date, to: Date) {
	return db
		.select(paymentFields)
		.from(payment)
		.innerJoin(user, eq(user.id, payment.userId))
		.where(and(gte(payment.createdAt, from), lt(payment.createdAt, to)))
		.orderBy(asc(payment.createdAt));
}
