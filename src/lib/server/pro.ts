/**
 * Tutora Pro ($5/month for tutors). Who has Pro: `proAccess(db, tutorId)`.
 *
 * CONTRACT (used by other modules; keep the signature):
 *   proAccess(db, tutorId) → { active: boolean; state: 'trial' | 'paid' | 'grace' | 'gift' | 'free' }
 *
 * Rules, in order: the owner's Pro pilot switch (on by default: every tutor has Pro free),
 * a gift from the owner, then the tutor's own subscription (paid until a date, 7 days of
 * grace, then Free; data is always kept). Paying works like Tutora Family: an invoice,
 * Tutora's payment details, proof, the owner confirms (a Tutora receipt "P-000001") or
 * rejects with a reason. Timers: `runProBilling` and `runTutorPayReminders` (hourly job).
 */
import { and, asc, desc, eq, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { user } from './db/auth.schema.ts';
import { charge, paymentAllocation } from './db/app.schema.ts';
import {
	tutoraSettings,
	TUTORA_PAY_METHODS,
	type TutoraInvoiceStatus
} from './db/family.schema.ts';
import { planGift, proInvoice, proSubscription, tutorPayReminder } from './db/pro.schema.ts';
import { perRequest } from './cache.ts';
import {
	addMonths,
	effectiveState,
	GRACE_DAYS,
	getTutoraSettings,
	type FamilyState
} from './family-billing.ts';
import { activeGift } from './plan-gifts.ts';
import { proQuote } from '../pro-pricing.ts';
import { dollars, isPeriod } from '../family-pricing.ts';
import { addDays } from '../tz.ts';
import { activeParents } from './family.ts';
import { balances, stillToPay, type ReceiptData } from './billing.ts';
import { getSettings } from './settings.ts';
import type { Notify } from './notify-core.ts';
import { m } from '../paraglide/messages.js';

export type ProState = 'trial' | 'paid' | 'grace' | 'gift' | 'free';
export interface ProAccess {
	active: boolean;
	state: ProState;
	/** true while the owner's Pro pilot switch gives every tutor Pro */
	pilot?: boolean;
	until?: Date | null;
}

export class ProFail extends Error {
	constructor(public code: string) {
		super(code);
	}
}

const DAY = 86_400_000;
const OPEN: TutoraInvoiceStatus[] = ['due', 'overdue', 'rejected'];

export function proReceiptNumber(n: number) {
	return `P-${String(n).padStart(6, '0')}`;
}

const clean = (v: unknown, max = 80) => {
	const s = String(v ?? '').trim();
	return s ? s.slice(0, max) : null;
};

/* ------------------------------------------------------------------ access */

/** Does this tutor have Pro right now? Remembered for the page being built. */
export function proAccess(db: DB, tutorId: string, now = new Date()): Promise<ProAccess> {
	return perRequest(db, `pro-access:${tutorId}`, async () => {
		const [settings, [sub], gift] = await Promise.all([
			getTutoraSettings(db),
			db.select().from(proSubscription).where(eq(proSubscription.tutorId, tutorId)),
			activeGift(db, 'pro', tutorId, now)
		]);
		if (settings.proPilotFreeTrial)
			return { active: true, state: 'trial', pilot: true, until: null };
		if (gift) return { active: true, state: 'gift', until: gift.until };
		const e = effectiveState(sub, now);
		return { active: e.state !== 'free', state: e.state, until: e.until };
	});
}

/** Branded reports (Pro): the tutor's name and colour for report PDFs, or null without Pro. */
export async function tutorBrand(
	db: DB,
	tutorId: string
): Promise<{ name: string; colour: string; logoKey: string | null } | null> {
	const access = await proAccess(db, tutorId);
	if (!access.active) return null;
	const [s, [sub]] = await Promise.all([
		getSettings(db, tutorId),
		db
			.select({ c: proSubscription.brandColour })
			.from(proSubscription)
			.where(eq(proSubscription.tutorId, tutorId))
	]);
	return {
		name: s.tutorName || '',
		colour: sub?.c ?? '#0b2545',
		logoKey: s.photoKey ?? null
	};
}

async function subscriptionFor(db: DB, tutorId: string) {
	const [sub] = await db.select().from(proSubscription).where(eq(proSubscription.tutorId, tutorId));
	if (sub) return sub;
	const [made] = await db
		.insert(proSubscription)
		.values({ tutorId, status: 'free' })
		.onConflictDoNothing()
		.returning();
	if (made) return made;
	const [again] = await db
		.select()
		.from(proSubscription)
		.where(eq(proSubscription.tutorId, tutorId));
	return again;
}

/** The data for the tutor's Pro pages. */
export async function proBilling(db: DB, tutorId: string, now = new Date()) {
	const [settings, [sub], invoices, access] = await Promise.all([
		getTutoraSettings(db),
		db.select().from(proSubscription).where(eq(proSubscription.tutorId, tutorId)),
		db
			.select()
			.from(proInvoice)
			.where(eq(proInvoice.tutorId, tutorId))
			.orderBy(desc(proInvoice.createdAt))
			.limit(50),
		proAccess(db, tutorId, now)
	]);
	return {
		settings,
		subscription: sub ?? null,
		state: effectiveState(sub, now) as { state: FamilyState; until: Date | null },
		invoices,
		access,
		canStartTrial: !settings.proPilotFreeTrial && settings.proTrialDays > 0 && !sub?.paidUntil
	};
}

export async function startProTrial(db: DB, tutorId: string, now = new Date()) {
	const settings = await getTutoraSettings(db);
	if (settings.proPilotFreeTrial || settings.proTrialDays <= 0)
		throw new ProFail('fb_err_no_trial');
	const sub = await subscriptionFor(db, tutorId);
	if (sub.paidUntil) throw new ProFail('fb_err_trial_used');
	await db
		.update(proSubscription)
		.set({ status: 'trial', paidUntil: addDays(now, settings.proTrialDays), updatedAt: now })
		.where(eq(proSubscription.id, sub.id));
}

/** Pro preferences: automatic payment reminders and the report colour. */
export async function setProPrefs(
	db: DB,
	tutorId: string,
	v: { autoReminders: boolean; brandColour?: string | null }
) {
	const sub = await subscriptionFor(db, tutorId);
	const colour = v.brandColour && /^#[0-9a-f]{6}$/i.test(v.brandColour) ? v.brandColour : null;
	await db
		.update(proSubscription)
		.set({ autoReminders: v.autoReminders, brandColour: colour, updatedAt: new Date() })
		.where(eq(proSubscription.id, sub.id));
}

/** Owner: the Pro pilot switch and trial length (the Family settings are left alone). */
export async function saveProSettings(
	db: DB,
	v: { proPilotFreeTrial: boolean; proTrialDays?: number | string | null }
) {
	const set = {
		proPilotFreeTrial: !!v.proPilotFreeTrial,
		proTrialDays: Math.max(0, Math.min(90, Math.round(Number(v.proTrialDays) || 0))),
		updatedAt: new Date()
	};
	await db
		.insert(tutoraSettings)
		.values({ id: 1, ...set })
		.onConflictDoUpdate({ target: tutoraSettings.id, set });
}

/* ------------------------------------------------------------------ invoices */

export async function createProInvoice(db: DB, tutorId: string, period: number, now = new Date()) {
	if (!isPeriod(period)) throw new ProFail('fb_err_period');
	const settings = await getTutoraSettings(db);
	const q = proQuote(period, settings);
	const sub = await subscriptionFor(db, tutorId);
	const st = effectiveState(sub, now);
	const periodStart =
		st.state === 'paid' && sub.paidUntil && sub.status !== 'trial' ? sub.paidUntil : now;
	await db
		.update(proInvoice)
		.set({ status: 'cancelled', updatedAt: now })
		.where(and(eq(proInvoice.tutorId, tutorId), inArray(proInvoice.status, OPEN)));
	const [inv] = await db
		.insert(proInvoice)
		.values({
			tutorId,
			subscriptionId: sub.id,
			periodMonths: q.period,
			amountCents: q.totalCents,
			discountPct: q.discountPct,
			status: 'due',
			dueOn: addDays(now, 3),
			periodStart,
			remindedBefore: now
		})
		.returning();
	return inv;
}

export async function myProInvoice(db: DB, tutorId: string, id: number) {
	const [inv] = await db
		.select()
		.from(proInvoice)
		.where(and(eq(proInvoice.id, id), eq(proInvoice.tutorId, tutorId)));
	return inv ?? null;
}

export async function submitProProof(
	db: DB,
	tutorId: string,
	id: number,
	v: { proofKey: string; reference: string | null; method: string },
	notifyOwners?: (subject: string, body: string) => Promise<void>,
	now = new Date()
) {
	const method = (TUTORA_PAY_METHODS as readonly string[]).includes(v.method)
		? (v.method as (typeof TUTORA_PAY_METHODS)[number])
		: 'other';
	const [inv] = await db
		.update(proInvoice)
		.set({
			status: 'proof_sent',
			proofKey: v.proofKey,
			reference: clean(v.reference, 80),
			method,
			rejectReason: null,
			updatedAt: now
		})
		.where(
			and(eq(proInvoice.id, id), eq(proInvoice.tutorId, tutorId), inArray(proInvoice.status, OPEN))
		)
		.returning();
	if (!inv) throw new ProFail('err_not_found');
	if (notifyOwners) {
		const [p] = await db.select({ name: user.name }).from(user).where(eq(user.id, tutorId));
		await notifyOwners(
			m.pro_owner_proof_s({ name: p?.name ?? '' }),
			m.fb_owner_proof_b({ amount: dollars(inv.amountCents) })
		);
	}
	return inv;
}

/* ------------------------------------------------------------------ owner */

export function ownerProInvoices(db: DB, status?: TutoraInvoiceStatus | 'open', limit = 100) {
	const where =
		status === 'open'
			? inArray(proInvoice.status, ['due', 'proof_sent', 'overdue'])
			: status
				? eq(proInvoice.status, status)
				: undefined;
	return db
		.select({
			id: proInvoice.id,
			tutorId: proInvoice.tutorId,
			tutorName: user.name,
			tutorEmail: user.email,
			periodMonths: proInvoice.periodMonths,
			amountCents: proInvoice.amountCents,
			discountPct: proInvoice.discountPct,
			status: proInvoice.status,
			dueOn: proInvoice.dueOn,
			proofKey: proInvoice.proofKey,
			reference: proInvoice.reference,
			method: proInvoice.method,
			rejectReason: proInvoice.rejectReason,
			receiptNo: proInvoice.receiptNo,
			confirmedAt: proInvoice.confirmedAt,
			createdAt: proInvoice.createdAt
		})
		.from(proInvoice)
		.innerJoin(user, eq(user.id, proInvoice.tutorId))
		.where(where)
		.orderBy(
			sql`case when ${proInvoice.status} = 'proof_sent' then 0 else 1 end`,
			desc(proInvoice.createdAt)
		)
		.limit(limit);
}

export async function confirmProInvoice(
	db: DB,
	ownerId: string,
	id: number,
	notify?: Notify,
	now = new Date()
) {
	const result = await db.transaction(async (tx) => {
		const [inv] = await tx.select().from(proInvoice).where(eq(proInvoice.id, id)).for('update');
		if (!inv || !['due', 'proof_sent', 'overdue', 'rejected'].includes(inv.status))
			throw new ProFail('err_not_found');
		await tx.execute(sql`lock table ${proInvoice} in share row exclusive mode`);
		const [{ n }] = await tx
			.select({ n: sql<number>`coalesce(max(${proInvoice.receiptNo}), 0)::int + 1` })
			.from(proInvoice);
		const sub = await subscriptionFor(tx as unknown as DB, inv.tutorId);
		const st = effectiveState(sub, now);
		const from =
			st.state === 'paid' && sub.status !== 'trial' && sub.paidUntil && sub.paidUntil > now
				? sub.paidUntil
				: inv.periodStart > now
					? inv.periodStart
					: now;
		const paidUntil = addMonths(from, inv.periodMonths);
		const [paid] = await tx
			.update(proInvoice)
			.set({ status: 'paid', receiptNo: n, confirmedBy: ownerId, confirmedAt: now, updatedAt: now })
			.where(eq(proInvoice.id, id))
			.returning();
		await tx
			.update(proSubscription)
			.set({ status: 'active', paidUntil, periodMonths: inv.periodMonths, updatedAt: now })
			.where(eq(proSubscription.id, sub.id));
		return { inv: paid, paidUntil };
	});
	await notify?.(
		result.inv.tutorId,
		m.pro_paid_s(),
		m.fb_paid_b({
			number: proReceiptNumber(result.inv.receiptNo!),
			date: result.paidUntil.toISOString().slice(0, 10)
		}),
		{ kind: 'payment', link: '/tutor/pro/billing' }
	);
	return result;
}

export async function rejectProInvoice(
	db: DB,
	id: number,
	reason: string,
	notify?: Notify,
	now = new Date()
) {
	const why = clean(reason, 300);
	if (!why) throw new ProFail('fb_err_reason');
	const [inv] = await db
		.update(proInvoice)
		.set({ status: 'rejected', rejectReason: why, updatedAt: now })
		.where(and(eq(proInvoice.id, id), inArray(proInvoice.status, ['due', 'proof_sent', 'overdue'])))
		.returning();
	if (!inv) throw new ProFail('err_not_found');
	await notify?.(inv.tutorId, m.fb_rejected_s(), m.fb_rejected_b({ reason: why }), {
		kind: 'payment',
		link: '/tutor/pro/billing'
	});
	return inv;
}

/** Owner dashboard: Pro tutors, Pro money this month, proofs waiting, overdue tutors. */
export async function ownerProStats(db: DB, now = new Date()) {
	const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
	const graceFrom = new Date(now.getTime() - GRACE_DAYS * DAY);
	const [[subs], [money], [proofs], [overdue], [gifts]] = await Promise.all([
		db
			.select({ n: sql<number>`count(*)::int` })
			.from(proSubscription)
			.where(
				and(
					inArray(proSubscription.status, ['active', 'grace']),
					gte(proSubscription.paidUntil, graceFrom)
				)
			),
		db
			.select({ cents: sql<number>`coalesce(sum(${proInvoice.amountCents}), 0)::int` })
			.from(proInvoice)
			.where(and(eq(proInvoice.status, 'paid'), gte(proInvoice.confirmedAt, monthStart))),
		db
			.select({ n: sql<number>`count(*)::int` })
			.from(proInvoice)
			.where(eq(proInvoice.status, 'proof_sent')),
		db
			.select({ n: sql<number>`count(distinct ${proInvoice.tutorId})::int` })
			.from(proInvoice)
			.where(eq(proInvoice.status, 'overdue')),
		db
			.select({ n: sql<number>`count(*)::int` })
			.from(planGift)
			.where(and(eq(planGift.plan, 'pro'), or(isNull(planGift.until), gte(planGift.until, now))))
	]);
	return {
		proTutors: subs?.n ?? 0,
		giftedPro: gifts?.n ?? 0,
		moneyThisMonthCents: money?.cents ?? 0,
		proofsWaiting: proofs?.n ?? 0,
		overdueTutors: overdue?.n ?? 0
	};
}

export async function proReceiptData(
	db: DB,
	id: number,
	tutorId?: string
): Promise<ReceiptData | null> {
	const [inv] = await db
		.select({ inv: proInvoice, name: user.name })
		.from(proInvoice)
		.innerJoin(user, eq(user.id, proInvoice.tutorId))
		.where(
			and(
				eq(proInvoice.id, id),
				eq(proInvoice.status, 'paid'),
				tutorId ? eq(proInvoice.tutorId, tutorId) : undefined
			)
		);
	if (!inv?.inv.receiptNo) return null;
	return {
		number: proReceiptNumber(inv.inv.receiptNo),
		date: inv.inv.confirmedAt ?? inv.inv.updatedAt,
		studentName: inv.name,
		method: inv.inv.method ?? 'other',
		reference: inv.inv.reference,
		amountCents: inv.inv.amountCents,
		currency: 'USD',
		covers: [
			{
				description: m.pro_receipt_line({ months: inv.inv.periodMonths }),
				amountCents: inv.inv.amountCents
			}
		],
		tutorName: 'Tutora',
		tutorEmail: null
	};
}

/* ------------------------------------------------------------------ the hourly job */

/** Next Pro invoices, reminders (3 days before, due day, 3 days after), free after 7 days. */
export async function runProBilling(db: DB, notify: Notify, now = new Date()) {
	let sent = 0;
	const settings = await getTutoraSettings(db);
	const link = { kind: 'payment' as const, link: '/tutor/pro/billing' };

	const ending = await db
		.select()
		.from(proSubscription)
		.where(
			and(
				eq(proSubscription.status, 'active'),
				lt(proSubscription.paidUntil, addDays(now, 7)),
				gte(proSubscription.paidUntil, now)
			)
		);
	for (const sub of ending) {
		const [open] = await db
			.select({ id: proInvoice.id })
			.from(proInvoice)
			.where(
				and(
					eq(proInvoice.tutorId, sub.tutorId),
					inArray(proInvoice.status, ['due', 'proof_sent', 'overdue', 'rejected'])
				)
			)
			.limit(1);
		if (open) continue;
		const q = proQuote(sub.periodMonths, settings);
		await db.insert(proInvoice).values({
			tutorId: sub.tutorId,
			subscriptionId: sub.id,
			periodMonths: q.period,
			amountCents: q.totalCents,
			discountPct: q.discountPct,
			status: 'due',
			dueOn: sub.paidUntil!,
			periodStart: sub.paidUntil!
		});
	}

	const unpaid = inArray(proInvoice.status, ['due', 'overdue', 'rejected']);
	const claim = (
		col: 'remindedBefore' | 'remindedDue' | 'remindedAfter',
		when: ReturnType<typeof and>
	) =>
		db
			.update(proInvoice)
			.set({ [col]: now })
			.where(and(unpaid, isNull(proInvoice[col]), when))
			.returning();
	for (const i of await claim(
		'remindedBefore',
		and(lt(proInvoice.dueOn, addDays(now, 3)), gte(proInvoice.dueOn, now))
	)) {
		await notify(
			i.tutorId,
			m.pro_remind_s(),
			m.fb_remind_before_b({ amount: dollars(i.amountCents) }),
			link
		);
		sent++;
	}
	for (const i of await claim(
		'remindedDue',
		and(lt(proInvoice.dueOn, now), gte(proInvoice.dueOn, addDays(now, -3)))
	)) {
		await notify(
			i.tutorId,
			m.pro_remind_s(),
			m.fb_remind_due_b({ amount: dollars(i.amountCents) }),
			link
		);
		sent++;
	}
	await db
		.update(proInvoice)
		.set({ status: 'overdue', updatedAt: now })
		.where(and(eq(proInvoice.status, 'due'), lt(proInvoice.dueOn, now)));
	for (const i of await claim('remindedAfter', lt(proInvoice.dueOn, addDays(now, -3)))) {
		await notify(
			i.tutorId,
			m.pro_remind_s(),
			m.fb_remind_after_b({ amount: dollars(i.amountCents) }),
			link
		);
		sent++;
	}

	await db
		.update(proSubscription)
		.set({ status: 'grace', updatedAt: now })
		.where(and(eq(proSubscription.status, 'active'), lt(proSubscription.paidUntil, now)));
	const dropped = await db
		.update(proSubscription)
		.set({ status: 'free', updatedAt: now })
		.where(
			or(
				and(
					eq(proSubscription.status, 'grace'),
					lt(proSubscription.paidUntil, addDays(now, -GRACE_DAYS))
				),
				and(eq(proSubscription.status, 'trial'), lt(proSubscription.paidUntil, now))
			)
		)
		.returning();
	for (const s of dropped) {
		await notify(s.tutorId, m.pro_dropped_s(), m.pro_dropped_b(), {
			kind: 'payment',
			link: '/tutor/pro'
		});
		sent++;
	}
	return sent;
}

/* ------------------------------------------------------------------ Pro: payment reminders */

export const PAY_REMIND_AFTER_DAYS = 3;
export const PAY_REMIND_EVERY_DAYS = 7;

/**
 * Tell a student (and the parents who follow them) what they still owe the tutor, as an
 * invoice notification. Returns how many people were told.
 */
export async function sendTutorInvoice(
	db: DB,
	notify: Notify,
	tutorId: string,
	studentId: string,
	now = new Date()
) {
	const [bal, s] = await Promise.all([
		balances(db, tutorId, [studentId]),
		getSettings(db, tutorId)
	]);
	const b = bal.get(studentId);
	const owed = b ? stillToPay(b) : 0;
	if (owed <= 0) return 0;
	const amount = `${s.currency === 'USD' ? '$' : 'ZWG '}${(owed / 100).toFixed(2)}`;
	const tutor = s.tutorName || '';
	await notify(studentId, m.pro_inv_s({ tutor }), m.pro_inv_b({ tutor, amount }), {
		kind: 'payment',
		link: '/student/payments'
	});
	let told = 1;
	for (const p of await activeParents(db, studentId)) {
		await notify(p, m.pro_inv_s({ tutor }), m.pro_inv_b({ tutor, amount }), {
			kind: 'payment',
			link: '/parent/payments'
		});
		told++;
	}
	await db
		.insert(tutorPayReminder)
		.values({ tutorId, userId: studentId, sentAt: now })
		.onConflictDoUpdate({
			target: [tutorPayReminder.tutorId, tutorPayReminder.userId],
			set: { sentAt: now }
		});
	return told;
}

/**
 * Hourly: for Pro tutors who switched automatic reminders on, remind each student who owes
 * money for a lesson more than 3 days old; at most once a week per student.
 */
export async function runTutorPayReminders(db: DB, notify: Notify, now = new Date()) {
	const tutors = await db
		.select({ tutorId: proSubscription.tutorId })
		.from(proSubscription)
		.where(eq(proSubscription.autoReminders, true));
	let sent = 0;
	for (const { tutorId } of tutors) {
		if (!(await proAccess(db, tutorId, now)).active) continue;
		// students with an unpaid charge older than 3 days
		const old = await db
			.select({ userId: charge.userId })
			.from(charge)
			.leftJoin(paymentAllocation, eq(paymentAllocation.chargeId, charge.id))
			.where(
				and(
					eq(charge.tutorId, tutorId),
					eq(charge.voided, false),
					lt(charge.createdAt, addDays(now, -PAY_REMIND_AFTER_DAYS))
				)
			)
			.groupBy(charge.id, charge.userId, charge.amountCents)
			.having(sql`coalesce(sum(${paymentAllocation.amountCents}), 0) < ${charge.amountCents}`)
			.orderBy(asc(charge.userId));
		const ids = [...new Set(old.map((r) => r.userId))];
		if (!ids.length) continue;
		const recent = await db
			.select({ userId: tutorPayReminder.userId })
			.from(tutorPayReminder)
			.where(
				and(
					eq(tutorPayReminder.tutorId, tutorId),
					inArray(tutorPayReminder.userId, ids),
					gte(tutorPayReminder.sentAt, addDays(now, -PAY_REMIND_EVERY_DAYS))
				)
			);
		const skip = new Set(recent.map((r) => r.userId));
		for (const sid of ids) {
			if (skip.has(sid)) continue;
			// claim first, so two runs never send twice
			const claimed = await db
				.insert(tutorPayReminder)
				.values({ tutorId, userId: sid, sentAt: now })
				.onConflictDoUpdate({
					target: [tutorPayReminder.tutorId, tutorPayReminder.userId],
					set: { sentAt: now },
					setWhere: lt(tutorPayReminder.sentAt, addDays(now, -PAY_REMIND_EVERY_DAYS))
				})
				.returning();
			if (!claimed.length) continue;
			sent += await sendTutorInvoice(db, notify, tutorId, sid, now);
		}
	}
	return sent;
}
