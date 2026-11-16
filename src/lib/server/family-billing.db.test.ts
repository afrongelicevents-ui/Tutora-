import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { freshDb, hasTestDb, testAuth } from './testing/db.ts';
import { makeUser, MONDAY_8AM } from './testing/fixtures.ts';
import type { DB } from './db/types.ts';
import { profile } from './db/app.schema.ts';
import { familyLink } from './db/v3.schema.ts';
import { familySubscription, subscriptionChild, tutoraInvoice } from './db/family.schema.ts';
import {
	addMonths,
	confirmInvoice,
	createCheckoutInvoice,
	effectiveState,
	familyAccess,
	familyHomeStrip,
	manyChildrenAccounts,
	ownerFamilyStats,
	ownerInvoices,
	rejectInvoice,
	runFamilyBilling,
	saveTutoraSettings,
	startTrial,
	submitProof,
	tutoraReceiptData
} from './family-billing.ts';
import { createInvite, redeemInvite } from './family.ts';
import { createChildAccount } from './family-accounts.ts';
import { receiptPdf } from './pdf.ts';
import { addDays } from '../tz.ts';
import type { Notify } from './notify-core.ts';

describe('effectiveState (no database)', () => {
	const now = new Date('2026-11-16T08:00:00Z');
	it('paid → grace for 7 days → free', () => {
		expect(effectiveState(null, now).state).toBe('free');
		expect(effectiveState({ status: 'active', paidUntil: addDays(now, 1) }, now).state).toBe(
			'paid'
		);
		expect(effectiveState({ status: 'grace', paidUntil: addDays(now, -2) }, now).state).toBe(
			'grace'
		);
		expect(effectiveState({ status: 'active', paidUntil: addDays(now, -8) }, now).state).toBe(
			'free'
		);
		expect(effectiveState({ status: 'trial', paidUntil: addDays(now, -1) }, now).state).toBe(
			'free'
		);
		expect(effectiveState({ status: 'free', paidUntil: addDays(now, 5) }, now).state).toBe('free');
	});
	it('adds calendar months', () => {
		expect(addMonths(new Date('2026-01-31T00:00:00Z'), 1).toISOString().slice(0, 10)).toBe(
			'2026-02-28'
		);
		expect(addMonths(new Date('2026-11-16T06:00:00Z'), 3).toISOString().slice(0, 10)).toBe(
			'2027-02-16'
		);
	});
});

describe.skipIf(!hasTestDb)('Tutora Family billing', () => {
	let db: DB;
	let close: () => Promise<void>;
	const now = MONDAY_8AM;
	const sent: { to: string; subject: string }[] = [];
	const notify: Notify = async (to, subject) => {
		sent.push({ to, subject });
	};

	beforeAll(async () => {
		({ db, close } = await freshDb());
	});
	afterAll(async () => close?.());

	async function family(nKids: number, under18 = true) {
		const parent = await makeUser(db, 'parent', 'Mrs Parent', null);
		const kids = [];
		for (let i = 0; i < nKids; i++) {
			const k = await makeUser(db, 'student', `Kid ${i + 1} Parent`, null);
			await db
				.update(profile)
				.set({ isUnder18: under18, managed: under18 })
				.where(eq(profile.userId, k.id));
			await db.insert(familyLink).values({ parentId: parent.id, studentId: k.id, guardian: true });
			kids.push(k);
		}
		return { parent, kids };
	}
	const pilot = (on: boolean, extra: Record<string, unknown> = {}) =>
		saveTutoraSettings(db, { pilotFreeTrial: on, trialDays: 14, ...extra });

	it('the pilot free trial (default ON) gives every family access', async () => {
		const { parent, kids } = await family(1);
		expect(await familyAccess(db, parent.id, now)).toMatchObject({ active: true, reason: 'pilot' });
		expect((await familyAccess(db, kids[0].id, now)).active).toBe(true);
	});

	it('with the pilot off: free level; a child asks their parent; an adult may pay alone', async () => {
		await pilot(false);
		const { parent, kids } = await family(1);
		expect(await familyAccess(db, parent.id, now)).toMatchObject({ active: false, reason: 'free' });
		expect(await familyAccess(db, kids[0].id, now)).toMatchObject({
			active: false,
			askParent: true
		});
		const adult = await makeUser(db, 'student', 'Adult Learner', null);
		expect(await familyAccess(db, adult.id, now)).toMatchObject({ canPaySelf: true });
		// the adult pays for themselves at the one-child price
		const inv = await createCheckoutInvoice(db, adult.id, [adult.id], 1, now);
		expect(inv.amountCents).toBe(1200);
		// a child under 18 can't
		await expect(createCheckoutInvoice(db, kids[0].id, [kids[0].id], 1, now)).rejects.toThrow(
			'fb_err_no_children'
		);
	});

	it('prices the checkout: per-child prices, period and the owner discount', async () => {
		await pilot(false, { discount3mPct: 10 });
		const { parent, kids } = await family(4);
		const ids = kids.map((k) => k.id);
		const one = await createCheckoutInvoice(db, parent.id, ids.slice(0, 1), 1, now);
		expect(one.amountCents).toBe(1200);
		const four = await createCheckoutInvoice(db, parent.id, ids, 1, now);
		expect(four.amountCents).toBe(3800);
		const three = await createCheckoutInvoice(db, parent.id, ids.slice(0, 3), 3, now);
		expect(three.amountCents).toBe(7560); // 28 × 3 − 10%
		expect(three.discountPct).toBe(10);
		// a new checkout replaces the unpaid one
		const [old] = await db.select().from(tutoraInvoice).where(eq(tutoraInvoice.id, four.id));
		expect(old.status).toBe('cancelled');
		// someone else's child can't be added
		const stranger = await makeUser(db, 'student', 'Not Mine', null);
		await expect(createCheckoutInvoice(db, parent.id, [stranger.id], 1, now)).rejects.toThrow(
			'fb_err_no_children'
		);
		await expect(createCheckoutInvoice(db, parent.id, ids, 2, now)).rejects.toThrow(
			'fb_err_period'
		);
		await pilot(false);
	});

	it('invoice lifecycle: proof → rejected (parent told) → proof → paid with a Tutora receipt', async () => {
		await pilot(false);
		const owner = await makeUser(db, 'owner', 'Owner');
		const { parent, kids } = await family(2);
		const inv = await createCheckoutInvoice(
			db,
			parent.id,
			kids.map((k) => k.id),
			3,
			now
		);
		expect(inv.amountCents).toBe(6000);
		const owners: string[] = [];
		await submitProof(
			db,
			parent.id,
			inv.id,
			{ proofKey: 'proofs/x.png', reference: 'ECO123', method: 'ecocash' },
			async (s) => {
				owners.push(s);
			},
			now
		);
		expect(owners).toHaveLength(1);
		// another parent can't send proof for it
		const other = await makeUser(db, 'parent', 'Other', null);
		await expect(
			submitProof(db, other.id, inv.id, { proofKey: 'k', reference: null, method: 'bank' })
		).rejects.toThrow('err_not_found');
		expect((await ownerInvoices(db, 'proof_sent')).some((r) => r.id === inv.id)).toBe(true);
		await expect(rejectInvoice(db, inv.id, '  ', notify, now)).rejects.toThrow('fb_err_reason');
		await rejectInvoice(db, inv.id, 'Amount does not match', notify, now);
		expect(sent.at(-1)?.to).toBe(parent.id);
		await submitProof(db, parent.id, inv.id, {
			proofKey: 'proofs/y.png',
			reference: 'ECO124',
			method: 'ecocash'
		});
		const r = await confirmInvoice(db, owner.id, inv.id, notify, now);
		expect(r.inv.status).toBe('paid');
		expect(r.paidUntil.toISOString()).toBe(addMonths(now, 3).toISOString());
		expect(sent.at(-1)?.to).toBe(parent.id);
		// can't be confirmed twice
		await expect(confirmInvoice(db, owner.id, inv.id, notify, now)).rejects.toThrow();
		expect(await familyAccess(db, parent.id, now)).toMatchObject({ active: true, reason: 'paid' });
		expect(await familyAccess(db, kids[0].id, now)).toMatchObject({ active: true, reason: 'paid' });
		// the receipt: Tutora-branded, one line per child, only for the payer
		const rec = await tutoraReceiptData(db, inv.id, parent.id);
		expect(rec?.number).toMatch(/^T-\d{6}$/);
		expect(rec?.tutorName).toBe('Tutora');
		expect(rec?.covers).toHaveLength(2);
		expect(rec?.covers.reduce((a, c) => a + c.amountCents, 0)).toBe(6000);
		expect(await tutoraReceiptData(db, inv.id, other.id)).toBeNull();
		const pdf = await receiptPdf(rec!);
		expect(pdf.byteLength).toBeGreaterThan(500);
		const strip = await familyHomeStrip(db, parent.id, now);
		expect(strip.covered.sort()).toEqual(kids.map((k) => k.id).sort());
	});

	it('one paying parent per child', async () => {
		await pilot(false);
		const owner = await makeUser(db, 'owner', 'Owner 2');
		const { parent, kids } = await family(1);
		const dad = await makeUser(db, 'parent', 'Dad', null);
		await db.insert(familyLink).values({ parentId: dad.id, studentId: kids[0].id });
		const a = await createCheckoutInvoice(db, parent.id, [kids[0].id], 1, now);
		// dad makes an invoice before mum's is confirmed …
		const b = await createCheckoutInvoice(db, dad.id, [kids[0].id], 1, now);
		await confirmInvoice(db, owner.id, a.id, notify, now);
		// … then neither a new checkout nor confirming his old one can cover the child twice
		await expect(createCheckoutInvoice(db, dad.id, [kids[0].id], 1, now)).rejects.toThrow(
			'fb_err_other_parent'
		);
		await expect(confirmInvoice(db, owner.id, b.id, notify, now)).rejects.toThrow(
			'fb_err_other_parent'
		);
	});

	it('the hourly job: next invoice, reminders once each, grace, free after 7 days', async () => {
		await pilot(false);
		const owner = await makeUser(db, 'owner', 'Owner 3');
		const { parent, kids } = await family(1);
		const inv = await createCheckoutInvoice(db, parent.id, [kids[0].id], 1, now);
		const { paidUntil } = await confirmInvoice(db, owner.id, inv.id, notify, now);
		const mine = () => sent.filter((s) => s.to === parent.id).length;
		const at = (days: number) => new Date(paidUntil.getTime() + days * 86_400_000);
		const invoices = () =>
			db
				.select()
				.from(tutoraInvoice)
				.where(and(eq(tutoraInvoice.parentId, parent.id), eq(tutoraInvoice.status, 'due')));

		// 5 days before the end: the next invoice is made, no reminder yet
		const before = mine();
		await runFamilyBilling(db, notify, at(-5));
		const [next] = await invoices();
		expect(next.dueOn.toISOString()).toBe(paidUntil.toISOString());
		expect(next.amountCents).toBe(1200);
		expect(mine()).toBe(before);
		await runFamilyBilling(db, notify, at(-5));
		expect(await invoices()).toHaveLength(1);

		// 2 days before: "due in 3 days", once
		await runFamilyBilling(db, notify, at(-2));
		expect(mine()).toBe(before + 1);
		await runFamilyBilling(db, notify, at(-1.9));
		expect(mine()).toBe(before + 1);

		// the due day: reminder, the invoice is overdue, the account in grace (still open)
		await runFamilyBilling(db, notify, at(0.05));
		await runFamilyBilling(db, notify, at(0.1));
		expect(mine()).toBe(before + 2);
		const [{ status }] = await db
			.select({ status: tutoraInvoice.status })
			.from(tutoraInvoice)
			.where(eq(tutoraInvoice.id, next.id));
		expect(status).toBe('overdue');
		expect(await familyAccess(db, kids[0].id, at(0.1))).toMatchObject({
			active: true,
			reason: 'grace'
		});

		// 3 days after: last reminder, once
		await runFamilyBilling(db, notify, at(3.1));
		await runFamilyBilling(db, notify, at(3.2));
		expect(mine()).toBe(before + 3);

		// 7 days after: the free level, everything kept
		await runFamilyBilling(db, notify, at(7.1));
		await runFamilyBilling(db, notify, at(7.2));
		expect(mine()).toBe(before + 4);
		const [sub] = await db
			.select()
			.from(familySubscription)
			.where(eq(familySubscription.parentId, parent.id));
		expect(sub.status).toBe('free');
		const covered = await db
			.select()
			.from(subscriptionChild)
			.where(eq(subscriptionChild.subscriptionId, sub.id));
		expect(covered.every((c) => !c.active)).toBe(true);
		expect(await familyAccess(db, kids[0].id, at(7.2))).toMatchObject({ active: false });
		expect(
			(await db.select().from(tutoraInvoice).where(eq(tutoraInvoice.parentId, parent.id))).length
		).toBe(2);
		// paying the overdue invoice later opens everything again, from that day
		const late = at(10);
		const r = await confirmInvoice(db, owner.id, next.id, notify, late);
		expect(r.paidUntil.toISOString()).toBe(addMonths(late, 1).toISOString());
		expect((await familyAccess(db, kids[0].id, late)).active).toBe(true);
	});

	it('the free trial (pilot off) is used once', async () => {
		await pilot(false);
		const { parent, kids } = await family(2);
		await startTrial(db, parent.id, now);
		expect(await familyAccess(db, kids[1].id, now)).toMatchObject({ reason: 'trial' });
		await expect(startTrial(db, parent.id, now)).rejects.toThrow('fb_err_trial_used');
		expect((await familyAccess(db, kids[1].id, addDays(now, 15))).active).toBe(false);
	});

	it('misuse: the parent-or-guardian tick is required to connect or make a child', async () => {
		const { parent } = await family(0);
		const kid = await makeUser(db, 'student', 'Coded Kid', null);
		const { code } = await createInvite(db, kid.id, now);
		await expect(
			redeemInvite(db, code, parent.id, { guardianClaim: false, confirmedParent: false }, now)
		).rejects.toThrow('fb_err_confirm_parent');
		// with the tick it connects
		const r = await redeemInvite(
			db,
			code,
			parent.id,
			{ guardianClaim: false, confirmedParent: true },
			now
		);
		expect(r.status).toBe('active');
		await db.update(profile).set({ phone: '+263771234567' }).where(eq(profile.userId, parent.id));
		const { auth } = testAuth(db);
		const no = await createChildAccount({ auth, db }, parent.id, {
			name: 'Tick Less',
			username: 'tick.less',
			password: 'a-long-password',
			confirmParent: false
		});
		expect(no.ok).toBe(false);
		if (!no.ok) expect(no.errors.confirmParent).toBe('fb_err_confirm_parent');
	});

	it('misuse: accounts with 4+ children are flagged; owner stats', async () => {
		const { parent } = await family(4);
		const flagged = await manyChildrenAccounts(db);
		expect(flagged.some((f) => f.parentId === parent.id && f.children === 4)).toBe(true);
		const s = await ownerFamilyStats(db, now);
		expect(s.activeSubscriptions).toBeGreaterThan(0);
		expect(s.children).toBeGreaterThan(0);
		expect(s.moneyThisMonthCents).toBeGreaterThan(0);
		expect(s.manyChildren.length).toBeGreaterThan(0);
	});
});
