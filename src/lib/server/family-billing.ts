/**
 * Tutora Family: the family's subscription to Tutora itself (planning, consistency,
 * progress, reports and support). Tutors are always paid separately, directly.
 *
 * - Prices: src/lib/family-pricing.ts (pure).
 * - Who has access: `familyAccess` (pilot free trial → everyone; otherwise a paid, trial or
 *   grace subscription that covers the person).
 * - Paying: the parent makes an invoice at checkout, sends proof (EcoCash / InnBucks / bank),
 *   the owner confirms (Tutora receipt) or rejects with a reason.
 * - Timers: `runFamilyBilling` (next invoice, reminders, drop to free after 7 days unpaid),
 *   run by the hourly GitHub job through scheduled.ts.
 */
import { and, asc, desc, eq, gte, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { user } from './db/auth.schema.ts';
import { profile } from './db/app.schema.ts';
import { familyLink } from './db/v3.schema.ts';
import {
	familySubscription,
	subscriptionChild,
	tutoraInvoice,
	tutoraSettings,
	TUTORA_PAY_METHODS,
	type InvoiceChild,
	type TutoraInvoiceStatus
} from './db/family.schema.ts';
import { perRequest } from './cache.ts';
import { activeGift } from './plan-gifts.ts';
import { planGift } from './db/pro.schema.ts';
import { termQuote, dollars, isPeriod } from '../family-pricing.ts';
import { billTerm, DEFAULT_TERMS, cleanTerms, type SchoolTerm } from '../terms.ts';
import { addDays } from '../tz.ts';
import type { Notify } from './notify-core.ts';
import type { ReceiptData } from './billing.ts';
import { shortName } from '../names.ts';
import { m } from '../paraglide/messages.js';

export const GRACE_DAYS = 7;
/** families with this many children or more are shown to the owner */
export const MANY_CHILDREN = 4;
const DAY = 86_400_000;

export class FamilyBillingFail extends Error {
	constructor(public code: string) {
		super(code);
	}
}

export function tutoraReceiptNumber(n: number) {
	return `T-${String(n).padStart(6, '0')}`;
}

export function addMonths(d: Date, n: number): Date {
	const x = new Date(d);
	const day = x.getUTCDate();
	x.setUTCMonth(x.getUTCMonth() + n);
	// 31 Jan + 1 month → 28/29 Feb, not 3 March
	if (x.getUTCDate() < day) x.setUTCDate(0);
	return x;
}

/* ------------------------------------------------------------------ settings */

export type TutoraSettings = typeof tutoraSettings.$inferSelect;

export const DEFAULT_SETTINGS: TutoraSettings = {
	id: 1,
	ecocashNumber: null,
	ecocashName: null,
	innbucksNumber: null,
	innbucksName: null,
	bankName: null,
	bankAccountName: null,
	bankAccountNumber: null,
	bankBranch: null,
	notes: null,
	discount3mPct: 0,
	discount6mPct: 0,
	termDates: null,
	pilotFreeTrial: true,
	trialDays: 30,
	proPilotFreeTrial: true,
	proTrialDays: 30,
	updatedAt: new Date(0)
};

export function getTutoraSettings(db: DB): Promise<TutoraSettings> {
	return perRequest(db, 'tutora-settings', async () => {
		const [row] = await db.select().from(tutoraSettings).where(eq(tutoraSettings.id, 1));
		return row ?? DEFAULT_SETTINGS;
	});
}

/** The school terms families pay by: the owner's, or rough defaults until they are set. */
export function schoolTerms(s: TutoraSettings): SchoolTerm[] {
	const t = cleanTerms(s.termDates);
	return t.length ? t : DEFAULT_TERMS;
}

/** true when the owner has filled in at least one way to pay */
export function hasPaymentDetails(s: TutoraSettings) {
	return !!(s.ecocashNumber || s.innbucksNumber || s.bankAccountNumber);
}

export interface SettingsInput {
	ecocashNumber?: string | null;
	ecocashName?: string | null;
	innbucksNumber?: string | null;
	innbucksName?: string | null;
	bankName?: string | null;
	bankAccountName?: string | null;
	bankAccountNumber?: string | null;
	bankBranch?: string | null;
	notes?: string | null;
	discount3mPct?: number | string | null;
	discount6mPct?: number | string | null;
	termDates?: SchoolTerm[] | null;
	pilotFreeTrial?: boolean;
	trialDays?: number | string | null;
}

const clean = (v: unknown, max = 80) => {
	const s = String(v ?? '').trim();
	return s ? s.slice(0, max) : null;
};
const pct = (v: unknown) => Math.max(0, Math.min(50, Math.round(Number(v) || 0)));

/** The owner saves how families pay Tutora (owner-only: the caller checks the role). */
export async function saveTutoraSettings(db: DB, v: SettingsInput) {
	const row = {
		ecocashNumber: clean(v.ecocashNumber, 30),
		ecocashName: clean(v.ecocashName),
		innbucksNumber: clean(v.innbucksNumber, 30),
		innbucksName: clean(v.innbucksName),
		bankName: clean(v.bankName),
		bankAccountName: clean(v.bankAccountName),
		bankAccountNumber: clean(v.bankAccountNumber, 40),
		bankBranch: clean(v.bankBranch),
		notes: clean(v.notes, 400),
		discount3mPct: pct(v.discount3mPct),
		discount6mPct: pct(v.discount6mPct),
		...(v.termDates !== undefined ? { termDates: cleanTerms(v.termDates) } : {}),
		pilotFreeTrial: !!v.pilotFreeTrial,
		trialDays: Math.max(0, Math.min(90, Math.round(Number(v.trialDays) || 0))),
		updatedAt: new Date()
	};
	await db
		.insert(tutoraSettings)
		.values({ id: 1, ...row })
		.onConflictDoUpdate({ target: tutoraSettings.id, set: row });
	return row;
}

/* ------------------------------------------------------------------ access */

export type FamilyState = 'trial' | 'paid' | 'grace' | 'free';

/** What a subscription row means right now (works even if the hourly job is late). */
export function effectiveState(
	sub: { status: string; paidUntil: Date | null } | null | undefined,
	now = new Date()
): { state: FamilyState; until: Date | null } {
	if (!sub || sub.status === 'free' || !sub.paidUntil) return { state: 'free', until: null };
	const t = sub.paidUntil.getTime();
	if (sub.status === 'trial')
		return t > now.getTime()
			? { state: 'trial', until: sub.paidUntil }
			: { state: 'free', until: null };
	if (t > now.getTime()) return { state: 'paid', until: sub.paidUntil };
	const graceEnd = new Date(t + GRACE_DAYS * DAY);
	if (graceEnd > now) return { state: 'grace', until: graceEnd };
	return { state: 'free', until: null };
}

export interface FamilyAccess {
	active: boolean;
	reason: 'pilot' | 'gift' | FamilyState;
	until: Date | null;
	/** a student under 18 with no parent on Tutora (shown "Ask your parent…") */
	askParent?: boolean;
	/** an adult student with no parent may pay for themselves */
	canPaySelf?: boolean;
}

/**
 * Does this person have Tutora Family? A parent: their own subscription. A student: a
 * subscription that covers them (their parent's, or their own as an adult). Remembered for
 * the page being built.
 */
export function familyAccess(db: DB, userId: string, now = new Date()): Promise<FamilyAccess> {
	return perRequest(db, `family-access:${userId}`, async () => {
		const [settings, [me], subs] = await Promise.all([
			getTutoraSettings(db),
			db
				.select({ role: user.role, isUnder18: profile.isUnder18 })
				.from(user)
				.leftJoin(profile, eq(profile.userId, user.id))
				.where(eq(user.id, userId)),
			// the person's own subscription, and any subscription that covers them as a child
			db
				.select({
					parentId: familySubscription.parentId,
					status: familySubscription.status,
					paidUntil: familySubscription.paidUntil,
					covered: subscriptionChild.active
				})
				.from(familySubscription)
				.leftJoin(
					subscriptionChild,
					and(
						eq(subscriptionChild.subscriptionId, familySubscription.id),
						eq(subscriptionChild.studentId, userId)
					)
				)
				.where(
					or(
						eq(familySubscription.parentId, userId),
						and(eq(subscriptionChild.studentId, userId), eq(subscriptionChild.active, true))
					)
				)
		]);
		if (settings.pilotFreeTrial) return { active: true, reason: 'pilot', until: null };
		// given free by the owner: to this person, or to a parent who follows them
		const gift = await activeGift(db, 'family', userId, now, true);
		if (gift) return { active: true, reason: 'gift', until: gift.until };
		let best: { state: FamilyState; until: Date | null } = { state: 'free', until: null };
		const rank: Record<FamilyState, number> = { free: 0, grace: 1, trial: 2, paid: 3 };
		for (const s of subs) {
			// a student counts only when covered; a parent's own subscription counts as is
			if (s.parentId !== userId && !s.covered) continue;
			if (me?.role === 'student' && s.parentId === userId && !s.covered) continue;
			const e = effectiveState(s, now);
			if (rank[e.state] > rank[best.state]) best = e;
		}
		const out: FamilyAccess = {
			active: best.state !== 'free',
			reason: best.state,
			until: best.until
		};
		if (!out.active && me?.role === 'student') {
			const [link] = await db
				.select({ p: familyLink.parentId })
				.from(familyLink)
				.where(and(eq(familyLink.studentId, userId), eq(familyLink.status, 'active')))
				.limit(1);
			if (link || me.isUnder18) out.askParent = true;
			else out.canPaySelf = true;
		}
		return out;
	});
}

/**
 * Which of a parent's children Tutora Family covers right now. `all`: the pilot, or a Family
 * gift to the parent. Otherwise only the children on a paid, trial or grace subscription
 * (`subscription_child.active`): a family that paid for one child of three has Family for
 * that one child only. Remembered for the page being built.
 */
export function familyCoverage(
	db: DB,
	parentId: string,
	now = new Date()
): Promise<{ all: boolean; covered: string[] }> {
	return perRequest(db, `family-coverage:${parentId}`, async () => {
		// one query (this runs on every parent page): the pilot switch, a Family gift to the
		// parent, the parent's subscription and the children it covers
		const res = await db.execute(sql`
			select
				coalesce((select pilot_free_trial from ${tutoraSettings} where id = 1),
					${DEFAULT_SETTINGS.pilotFreeTrial}) as pilot,
				exists(select 1 from ${planGift} g where g.plan = 'family' and g.user_id = ${parentId}
					and (g.until is null or g.until > ${now.toISOString()}::timestamptz)) as gift,
				s.status, s.paid_until,
				coalesce((select array_agg(c.student_id) from ${subscriptionChild} c
					where c.subscription_id = s.id and c.active), '{}') as kids
			from (select 1) one
			left join ${familySubscription} s on s.parent_id = ${parentId}`);
		const [r] = ((res as unknown as { rows?: unknown[] }).rows ??
			(res as unknown as unknown[])) as {
			pilot: boolean;
			gift: boolean;
			status: string | null;
			paid_until: string | Date | null;
			kids: string[] | null;
		}[];
		if (!r || r.pilot || r.gift) return { all: true, covered: [] };
		const sub = r.status
			? { status: r.status, paidUntil: r.paid_until ? new Date(r.paid_until) : null }
			: null;
		if (!sub || effectiveState(sub, now).state === 'free') return { all: false, covered: [] };
		return { all: false, covered: r.kids ?? [] };
	});
}

/** Does Tutora Family cover this child of this parent? */
export async function childCovered(db: DB, parentId: string, childId: string, now = new Date()) {
	const c = await familyCoverage(db, parentId, now);
	return c.all || c.covered.includes(childId);
}

/* ------------------------------------------------------------------ the family */

/**
 * Who a payer can pay for: a parent's actively connected children; an adult student with
 * no parent connected, themselves.
 */
export async function payableChildren(db: DB, payerId: string) {
	const [me] = await db
		.select({ role: user.role, name: user.name, isUnder18: profile.isUnder18 })
		.from(user)
		.leftJoin(profile, eq(profile.userId, user.id))
		.where(eq(user.id, payerId));
	if (!me) return [];
	if (me.role === 'student') {
		if (me.isUnder18) return [];
		const [link] = await db
			.select({ p: familyLink.parentId })
			.from(familyLink)
			.where(and(eq(familyLink.studentId, payerId), eq(familyLink.status, 'active')))
			.limit(1);
		return link ? [] : [{ id: payerId, name: me.name }];
	}
	if (me.role !== 'parent') return [];
	const rows = await db
		.select({ id: familyLink.studentId, name: user.name })
		.from(familyLink)
		.innerJoin(user, eq(user.id, familyLink.studentId))
		.where(
			and(
				eq(familyLink.parentId, payerId),
				eq(familyLink.status, 'active'),
				isNull(user.suspendedAt)
			)
		)
		.orderBy(asc(familyLink.createdAt));
	return rows;
}

/** Children (ids) already covered by ANOTHER paying account. */
export async function coveredElsewhere(db: DB, payerId: string, childIds: string[]) {
	if (!childIds.length) return [];
	const rows = await db
		.select({ studentId: subscriptionChild.studentId })
		.from(subscriptionChild)
		.innerJoin(familySubscription, eq(familySubscription.id, subscriptionChild.subscriptionId))
		.where(
			and(
				inArray(subscriptionChild.studentId, childIds),
				eq(subscriptionChild.active, true),
				ne(familySubscription.parentId, payerId)
			)
		);
	return rows.map((r) => r.studentId);
}

async function subscriptionFor(db: DB, payerId: string) {
	const [sub] = await db
		.select()
		.from(familySubscription)
		.where(eq(familySubscription.parentId, payerId));
	if (sub) return sub;
	const [made] = await db
		.insert(familySubscription)
		.values({ parentId: payerId, status: 'free' })
		.onConflictDoNothing()
		.returning();
	if (made) return made;
	const [again] = await db
		.select()
		.from(familySubscription)
		.where(eq(familySubscription.parentId, payerId));
	return again;
}

/** The page data for Plans / Checkout / Billing. */
export async function familyBilling(db: DB, payerId: string, now = new Date()) {
	const [settings, kids, [sub], invoices, access] = await Promise.all([
		getTutoraSettings(db),
		payableChildren(db, payerId),
		db.select().from(familySubscription).where(eq(familySubscription.parentId, payerId)),
		db
			.select()
			.from(tutoraInvoice)
			.where(eq(tutoraInvoice.parentId, payerId))
			.orderBy(desc(tutoraInvoice.createdAt))
			.limit(50),
		familyAccess(db, payerId, now)
	]);
	const coveredRows = sub
		? await db
				.select({ studentId: subscriptionChild.studentId, active: subscriptionChild.active })
				.from(subscriptionChild)
				.where(eq(subscriptionChild.subscriptionId, sub.id))
		: [];
	const elsewhere = await coveredElsewhere(
		db,
		payerId,
		kids.map((k) => k.id)
	);
	return {
		settings,
		children: kids.map((k) => ({
			...k,
			covered: coveredRows.some((r) => r.studentId === k.id && r.active),
			elsewhere: elsewhere.includes(k.id)
		})),
		subscription: sub ?? null,
		state: effectiveState(sub, now),
		invoices,
		access,
		/** the parent may start the free trial (pilot off, trial days set, never used) */
		canStartTrial: !settings.pilotFreeTrial && settings.trialDays > 0 && !sub?.paidUntil
	};
}

/** The one-time free trial when the pilot is off. */
export async function startTrial(db: DB, payerId: string, now = new Date()) {
	const settings = await getTutoraSettings(db);
	if (settings.pilotFreeTrial || settings.trialDays <= 0)
		throw new FamilyBillingFail('fb_err_no_trial');
	const kids = await payableChildren(db, payerId);
	if (!kids.length) throw new FamilyBillingFail('fb_err_no_children');
	const sub = await subscriptionFor(db, payerId);
	if (sub.paidUntil) throw new FamilyBillingFail('fb_err_trial_used');
	const elsewhere = await coveredElsewhere(
		db,
		payerId,
		kids.map((k) => k.id)
	);
	const ids = kids.map((k) => k.id).filter((id) => !elsewhere.includes(id));
	if (!ids.length) throw new FamilyBillingFail('fb_err_other_parent');
	await db
		.update(familySubscription)
		.set({ status: 'trial', paidUntil: addDays(now, settings.trialDays), updatedAt: now })
		.where(eq(familySubscription.id, sub.id));
	await setCovered(db, sub.id, ids);
}

/** Marks exactly these children as covered by the subscription (others not). */
async function setCovered(db: DB, subscriptionId: number, ids: string[]) {
	await db
		.update(subscriptionChild)
		.set({ active: false })
		.where(eq(subscriptionChild.subscriptionId, subscriptionId));
	if (!ids.length) return;
	await db
		.insert(subscriptionChild)
		.values(ids.map((studentId) => ({ subscriptionId, studentId, active: true })))
		.onConflictDoUpdate({
			target: [subscriptionChild.subscriptionId, subscriptionChild.studentId],
			set: { active: true }
		});
}

/* ------------------------------------------------------------------ invoices */

const OPEN: TutoraInvoiceStatus[] = ['due', 'overdue', 'rejected'];

/**
 * Checkout: an invoice for the chosen children and period. One paying parent per child:
 * a child already covered by another account can't be added.
 */
export async function createCheckoutInvoice(
	db: DB,
	payerId: string,
	childIds: string[],
	period: number,
	now = new Date()
) {
	if (!isPeriod(period)) throw new FamilyBillingFail('fb_err_period');
	const kids = await payableChildren(db, payerId);
	const chosen = kids.filter((k) => childIds.includes(k.id));
	if (!chosen.length || chosen.length !== new Set(childIds).size)
		throw new FamilyBillingFail('fb_err_no_children');
	if (
		(
			await coveredElsewhere(
				db,
				payerId,
				chosen.map((k) => k.id)
			)
		).length
	)
		throw new FamilyBillingFail('fb_err_other_parent');
	const settings = await getTutoraSettings(db);
	const sub = await subscriptionFor(db, payerId);
	const st = effectiveState(sub, now);
	// a paid period continues from its end; otherwise it starts now
	const periodStart =
		st.state === 'paid' && sub.paidUntil && sub.status !== 'trial' ? sub.paidUntil : now;
	// paid per school term: joining mid-term pays only for the rest of it
	const term = billTerm(schoolTerms(settings), periodStart);
	const q = termQuote(chosen.length, term.fraction);
	// an unpaid invoice from before is replaced (one with proof sent stays for the owner)
	await db
		.update(tutoraInvoice)
		.set({ status: 'cancelled', updatedAt: now })
		.where(and(eq(tutoraInvoice.parentId, payerId), inArray(tutoraInvoice.status, OPEN)));
	const children: InvoiceChild[] = chosen.map((k, i) => ({
		id: k.id,
		name: k.name,
		cents: q.perChildCents[i]
	}));
	const [inv] = await db
		.insert(tutoraInvoice)
		.values({
			parentId: payerId,
			subscriptionId: sub.id,
			children,
			periodMonths: 3,
			amountCents: q.totalCents,
			discountPct: 0,
			status: 'due',
			dueOn: addDays(now, 3),
			periodStart,
			periodEnd: term.coversUntil,
			// made by the parent just now: no "due soon" reminder needed
			remindedBefore: now
		})
		.returning();
	return inv;
}

export async function myInvoice(db: DB, payerId: string, id: number) {
	const [inv] = await db
		.select()
		.from(tutoraInvoice)
		.where(and(eq(tutoraInvoice.id, id), eq(tutoraInvoice.parentId, payerId)));
	return inv ?? null;
}

/** The parent sends proof of payment (the file is stored by the caller). */
export async function submitProof(
	db: DB,
	payerId: string,
	id: number,
	v: { proofKey: string; reference: string | null; method: string },
	notifyOwners?: (subject: string, body: string) => Promise<void>,
	now = new Date()
) {
	const method = (TUTORA_PAY_METHODS as readonly string[]).includes(v.method)
		? (v.method as (typeof TUTORA_PAY_METHODS)[number])
		: 'other';
	const [inv] = await db
		.update(tutoraInvoice)
		.set({
			status: 'proof_sent',
			proofKey: v.proofKey,
			reference: clean(v.reference, 80),
			method,
			rejectReason: null,
			updatedAt: now
		})
		.where(
			and(
				eq(tutoraInvoice.id, id),
				eq(tutoraInvoice.parentId, payerId),
				inArray(tutoraInvoice.status, OPEN)
			)
		)
		.returning();
	if (!inv) throw new FamilyBillingFail('err_not_found');
	if (notifyOwners) {
		const [p] = await db.select({ name: user.name }).from(user).where(eq(user.id, payerId));
		await notifyOwners(
			m.fb_owner_proof_s({ name: p?.name ?? '' }),
			m.fb_owner_proof_b({ amount: dollars(inv.amountCents) })
		);
	}
	return inv;
}

/* ------------------------------------------------------------------ owner */

/** Owner: invoices by status (newest first), with the payer's name and email. */
export function ownerInvoices(db: DB, status?: TutoraInvoiceStatus | 'open', limit = 100) {
	const where =
		status === 'open'
			? inArray(tutoraInvoice.status, ['due', 'proof_sent', 'overdue'])
			: status
				? eq(tutoraInvoice.status, status)
				: undefined;
	return db
		.select({
			id: tutoraInvoice.id,
			parentId: tutoraInvoice.parentId,
			parentName: user.name,
			parentEmail: user.email,
			children: tutoraInvoice.children,
			periodMonths: tutoraInvoice.periodMonths,
			amountCents: tutoraInvoice.amountCents,
			discountPct: tutoraInvoice.discountPct,
			status: tutoraInvoice.status,
			dueOn: tutoraInvoice.dueOn,
			proofKey: tutoraInvoice.proofKey,
			reference: tutoraInvoice.reference,
			method: tutoraInvoice.method,
			rejectReason: tutoraInvoice.rejectReason,
			receiptNo: tutoraInvoice.receiptNo,
			confirmedAt: tutoraInvoice.confirmedAt,
			createdAt: tutoraInvoice.createdAt
		})
		.from(tutoraInvoice)
		.innerJoin(user, eq(user.id, tutoraInvoice.parentId))
		.where(where)
		.orderBy(
			// proof waiting for the owner first
			sql`case when ${tutoraInvoice.status} = 'proof_sent' then 0 else 1 end`,
			desc(tutoraInvoice.createdAt)
		)
		.limit(limit);
}

/**
 * Owner confirms a payment: the invoice is paid with the next Tutora receipt number, the
 * subscription runs to the end of the paid period and the invoice's children are covered.
 */
export async function confirmInvoice(
	db: DB,
	ownerId: string,
	id: number,
	notify?: Notify,
	now = new Date()
) {
	const result = await db.transaction(async (tx) => {
		const [inv] = await tx
			.select()
			.from(tutoraInvoice)
			.where(eq(tutoraInvoice.id, id))
			.for('update');
		if (!inv || !['due', 'proof_sent', 'overdue', 'rejected'].includes(inv.status))
			throw new FamilyBillingFail('err_not_found');
		const ids = inv.children.map((c) => c.id);
		if ((await coveredElsewhere(tx as unknown as DB, inv.parentId, ids)).length)
			throw new FamilyBillingFail('fb_err_other_parent');
		await tx.execute(sql`lock table ${tutoraInvoice} in share row exclusive mode`);
		const [{ n }] = await tx
			.select({ n: sql<number>`coalesce(max(${tutoraInvoice.receiptNo}), 0)::int + 1` })
			.from(tutoraInvoice);
		const sub = await subscriptionFor(tx as unknown as DB, inv.parentId);
		const st = effectiveState(sub, now);
		// paid on time: from the end of the last period; late or new: from today
		const from =
			st.state === 'paid' && sub.status !== 'trial' && sub.paidUntil && sub.paidUntil > now
				? sub.paidUntil
				: inv.periodStart > now
					? inv.periodStart
					: now;
		// per-term invoices run to the term's end (the next term's start); older ones by months
		const paidUntil =
			inv.periodEnd && inv.periodEnd > from ? inv.periodEnd : addMonths(from, inv.periodMonths);
		const [paid] = await tx
			.update(tutoraInvoice)
			.set({ status: 'paid', receiptNo: n, confirmedBy: ownerId, confirmedAt: now, updatedAt: now })
			.where(eq(tutoraInvoice.id, id))
			.returning();
		await tx
			.update(familySubscription)
			.set({ status: 'active', paidUntil, periodMonths: inv.periodMonths, updatedAt: now })
			.where(eq(familySubscription.id, sub.id));
		await setCovered(tx as unknown as DB, sub.id, ids);
		return { inv: paid, paidUntil };
	});
	await notify?.(
		result.inv.parentId,
		m.fb_paid_s(),
		m.fb_paid_b({
			number: tutoraReceiptNumber(result.inv.receiptNo!),
			date: result.paidUntil.toISOString().slice(0, 10)
		}),
		{ kind: 'payment', link: '/parent/billing' }
	);
	return result;
}

/** Owner rejects proof with a reason; the parent is told and can send it again. */
export async function rejectInvoice(
	db: DB,
	id: number,
	reason: string,
	notify?: Notify,
	now = new Date()
) {
	const why = clean(reason, 300);
	if (!why) throw new FamilyBillingFail('fb_err_reason');
	const [inv] = await db
		.update(tutoraInvoice)
		.set({ status: 'rejected', rejectReason: why, updatedAt: now })
		.where(
			and(eq(tutoraInvoice.id, id), inArray(tutoraInvoice.status, ['due', 'proof_sent', 'overdue']))
		)
		.returning();
	if (!inv) throw new FamilyBillingFail('err_not_found');
	await notify?.(inv.parentId, m.fb_rejected_s(), m.fb_rejected_b({ reason: why }), {
		kind: 'payment',
		link: '/parent/billing'
	});
	return inv;
}

/** Owner dashboard figures. */
export async function ownerFamilyStats(db: DB, now = new Date()) {
	const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
	const graceFrom = new Date(now.getTime() - GRACE_DAYS * DAY);
	const [[subs], [kids], [money], [overdue], [proofs], many] = await Promise.all([
		db
			.select({ n: sql<number>`count(*)::int` })
			.from(familySubscription)
			.where(
				and(
					inArray(familySubscription.status, ['active', 'grace']),
					gte(familySubscription.paidUntil, graceFrom)
				)
			),
		db
			.select({ n: sql<number>`count(distinct ${subscriptionChild.studentId})::int` })
			.from(subscriptionChild)
			.innerJoin(familySubscription, eq(familySubscription.id, subscriptionChild.subscriptionId))
			.where(
				and(
					eq(subscriptionChild.active, true),
					inArray(familySubscription.status, ['active', 'grace']),
					gte(familySubscription.paidUntil, graceFrom)
				)
			),
		db
			.select({ cents: sql<number>`coalesce(sum(${tutoraInvoice.amountCents}), 0)::int` })
			.from(tutoraInvoice)
			.where(and(eq(tutoraInvoice.status, 'paid'), gte(tutoraInvoice.confirmedAt, monthStart))),
		db
			.select({ n: sql<number>`count(distinct ${tutoraInvoice.parentId})::int` })
			.from(tutoraInvoice)
			.where(eq(tutoraInvoice.status, 'overdue')),
		db
			.select({ n: sql<number>`count(*)::int` })
			.from(tutoraInvoice)
			.where(eq(tutoraInvoice.status, 'proof_sent')),
		manyChildrenAccounts(db)
	]);
	return {
		activeSubscriptions: subs?.n ?? 0,
		children: kids?.n ?? 0,
		moneyThisMonthCents: money?.cents ?? 0,
		overdueAccounts: overdue?.n ?? 0,
		proofsWaiting: proofs?.n ?? 0,
		manyChildren: many
	};
}

/** Misuse check: parent accounts connected to 4 or more children, for the owner to look at. */
export function manyChildrenAccounts(db: DB) {
	return db
		.select({
			parentId: familyLink.parentId,
			name: user.name,
			email: user.email,
			children: sql<number>`count(*)::int`
		})
		.from(familyLink)
		.innerJoin(user, eq(user.id, familyLink.parentId))
		.where(eq(familyLink.status, 'active'))
		.groupBy(familyLink.parentId, user.name, user.email)
		.having(sql`count(*) >= ${MANY_CHILDREN}`)
		.orderBy(desc(sql`count(*)`));
}

/* ------------------------------------------------------------------ receipt */

/** Receipt contents (same layout as tutor receipts, Tutora as the issuer). */
export async function tutoraReceiptData(
	db: DB,
	id: number,
	payerId?: string
): Promise<ReceiptData | null> {
	const [inv] = await db
		.select({ inv: tutoraInvoice, name: user.name })
		.from(tutoraInvoice)
		.innerJoin(user, eq(user.id, tutoraInvoice.parentId))
		.where(
			and(
				eq(tutoraInvoice.id, id),
				eq(tutoraInvoice.status, 'paid'),
				payerId ? eq(tutoraInvoice.parentId, payerId) : undefined
			)
		);
	if (!inv?.inv.receiptNo) return null;
	const months = inv.inv.periodMonths;
	return {
		number: tutoraReceiptNumber(inv.inv.receiptNo),
		date: inv.inv.confirmedAt ?? inv.inv.updatedAt,
		studentName: inv.name,
		method: inv.inv.method ?? 'other',
		reference: inv.inv.reference,
		amountCents: inv.inv.amountCents,
		currency: 'USD',
		covers: inv.inv.children.map((c) => ({
			description: inv.inv.periodEnd
				? m.fb_receipt_line_term({
						name: shortName(c.name),
						until: inv.inv.periodEnd.toISOString().slice(0, 10)
					})
				: m.fb_receipt_line({ name: shortName(c.name), months }),
			amountCents: c.cents
		})),
		tutorName: 'Tutora',
		tutorEmail: null
	};
}

/* ------------------------------------------------------------------ the hourly job */

/**
 * Run hourly (scheduled.ts): make the next invoice a week before a paid period ends,
 * remind 3 days before, on the due day and 3 days after (each claimed once), and drop an
 * account to the free level 7 days after it ran out unpaid. Data is always kept.
 */
export async function runFamilyBilling(db: DB, notify: Notify, now = new Date()) {
	let sent = 0;
	const settings = await getTutoraSettings(db);
	const link = { kind: 'payment' as const, link: '/parent/billing' };

	// 1. the next invoice, 7 days before the period ends
	const ending = await db
		.select()
		.from(familySubscription)
		.where(
			and(
				eq(familySubscription.status, 'active'),
				lt(familySubscription.paidUntil, addDays(now, 7)),
				gte(familySubscription.paidUntil, now)
			)
		);
	for (const sub of ending) {
		const [open] = await db
			.select({ id: tutoraInvoice.id })
			.from(tutoraInvoice)
			.where(
				and(
					eq(tutoraInvoice.parentId, sub.parentId),
					inArray(tutoraInvoice.status, ['due', 'proof_sent', 'overdue', 'rejected'])
				)
			)
			.limit(1);
		if (open) continue;
		const kids = await db
			.select({ id: subscriptionChild.studentId, name: user.name })
			.from(subscriptionChild)
			.innerJoin(user, eq(user.id, subscriptionChild.studentId))
			.where(and(eq(subscriptionChild.subscriptionId, sub.id), eq(subscriptionChild.active, true)))
			.orderBy(asc(subscriptionChild.createdAt));
		if (!kids.length) continue;
		const term = billTerm(schoolTerms(settings), sub.paidUntil!);
		const q = termQuote(kids.length, term.fraction);
		await db.insert(tutoraInvoice).values({
			parentId: sub.parentId,
			subscriptionId: sub.id,
			children: kids.map((k, i) => ({ id: k.id, name: k.name, cents: q.perChildCents[i] })),
			periodMonths: 3,
			amountCents: q.totalCents,
			discountPct: 0,
			status: 'due',
			dueOn: sub.paidUntil!,
			periodStart: sub.paidUntil!,
			periodEnd: term.coversUntil
		});
	}

	// 2. reminders, each claimed before it is sent
	const unpaid = inArray(tutoraInvoice.status, ['due', 'overdue', 'rejected']);
	const claim = async (
		col: 'remindedBefore' | 'remindedDue' | 'remindedAfter',
		when: ReturnType<typeof and>
	) =>
		db
			.update(tutoraInvoice)
			.set({ [col]: now })
			.where(and(unpaid, isNull(tutoraInvoice[col]), when))
			.returning();
	const before = await claim(
		'remindedBefore',
		and(lt(tutoraInvoice.dueOn, addDays(now, 3)), gte(tutoraInvoice.dueOn, now))
	);
	for (const i of before) {
		await notify(
			i.parentId,
			m.fb_remind_before_s(),
			m.fb_remind_before_b({ amount: dollars(i.amountCents) }),
			link
		);
		sent++;
	}
	const onDay = await claim(
		'remindedDue',
		and(lt(tutoraInvoice.dueOn, now), gte(tutoraInvoice.dueOn, addDays(now, -3)))
	);
	for (const i of onDay) {
		await notify(
			i.parentId,
			m.fb_remind_due_s(),
			m.fb_remind_due_b({ amount: dollars(i.amountCents) }),
			link
		);
		sent++;
	}
	// due date passed: overdue
	await db
		.update(tutoraInvoice)
		.set({ status: 'overdue', updatedAt: now })
		.where(and(eq(tutoraInvoice.status, 'due'), lt(tutoraInvoice.dueOn, now)));
	const after = await claim('remindedAfter', lt(tutoraInvoice.dueOn, addDays(now, -3)));
	for (const i of after) {
		await notify(
			i.parentId,
			m.fb_remind_after_s(),
			m.fb_remind_after_b({ amount: dollars(i.amountCents) }),
			link
		);
		sent++;
	}

	// 3. ran out: grace, then the free level after 7 days (data kept)
	await db
		.update(familySubscription)
		.set({ status: 'grace', updatedAt: now })
		.where(and(eq(familySubscription.status, 'active'), lt(familySubscription.paidUntil, now)));
	const dropped = await db
		.update(familySubscription)
		.set({ status: 'free', updatedAt: now })
		.where(
			or(
				and(
					eq(familySubscription.status, 'grace'),
					lt(familySubscription.paidUntil, addDays(now, -GRACE_DAYS))
				),
				and(eq(familySubscription.status, 'trial'), lt(familySubscription.paidUntil, now))
			)
		)
		.returning();
	for (const s of dropped) {
		await db
			.update(subscriptionChild)
			.set({ active: false })
			.where(eq(subscriptionChild.subscriptionId, s.id));
		await notify(s.parentId, m.fb_dropped_s(), m.fb_dropped_b(), {
			kind: 'payment',
			link: '/parent/plans'
		});
		sent++;
	}
	return sent;
}

/** Parent home: the plan's state, an invoice to pay, and which children are covered. */
export async function familyHomeStrip(db: DB, parentId: string, now = new Date()) {
	const [access, [open], coverage] = await Promise.all([
		familyAccess(db, parentId, now),
		db
			.select({ id: tutoraInvoice.id, status: tutoraInvoice.status, dueOn: tutoraInvoice.dueOn })
			.from(tutoraInvoice)
			.where(
				and(
					eq(tutoraInvoice.parentId, parentId),
					inArray(tutoraInvoice.status, ['due', 'overdue', 'rejected'])
				)
			)
			.orderBy(desc(tutoraInvoice.createdAt))
			.limit(1),
		familyCoverage(db, parentId, now)
	]);
	return {
		reason: access.reason,
		until: access.until,
		active: access.active,
		// during the pilot nothing is due: no Pay now, no overdue warning
		payInvoiceId: access.reason === 'pilot' ? null : (open?.id ?? null),
		overdueSince: access.reason !== 'pilot' && open?.status === 'overdue' ? open.dueOn : null,
		/** every child is covered (pilot or a gift) */
		all: coverage.all,
		covered: coverage.covered
	};
}
