import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshDb, hasTestDb } from './testing/db.ts';
import { makeUser, MONDAY_8AM } from './testing/fixtures.ts';
import type { DB } from './db/types.ts';
import { charge, profile } from './db/app.schema.ts';
import { familyLink } from './db/v3.schema.ts';
import { proInvoice, proSubscription } from './db/pro.schema.ts';
import {
	confirmProInvoice,
	createProInvoice,
	ownerProStats,
	proAccess,
	proBilling,
	proReceiptData,
	rejectProInvoice,
	runProBilling,
	runTutorPayReminders,
	saveProSettings,
	sendTutorInvoice,
	setProPrefs,
	startProTrial,
	submitProProof,
	tutorBrand
} from './pro.ts';
import { addMonths, familyAccess, saveTutoraSettings } from './family-billing.ts';
import { activeGift, giveGift, listGifts, removeGift } from './plan-gifts.ts';
import { proQuote } from '../pro-pricing.ts';
import { tablePdf } from './pro-pdf.ts';
import { studentInsights } from './pro-earnings.ts';
import { addDays } from '../tz.ts';
import type { Notify } from './notify-core.ts';

describe('Pro price (no database)', () => {
	it('is $5 a month, with the owner discounts for 3 and 6 months', () => {
		const d = { discount3mPct: 10, discount6mPct: 20 };
		expect(proQuote(1, d).totalCents).toBe(500);
		expect(proQuote(3, d).totalCents).toBe(1350);
		expect(proQuote(6, d)).toMatchObject({ totalCents: 2400, discountPct: 20 });
		expect(proQuote(2, d).period).toBe(1);
	});
	it('makes a branded table PDF', async () => {
		const pdf = await tablePdf({
			title: 'Earnings report',
			from: 'Chipo Moyo',
			brandColour: '#1f5fa8',
			sections: [
				{
					heading: 'By month',
					columns: ['Month', 'Income'],
					right: [1],
					rows: Array.from({ length: 80 }, (_, i) => [`Month ${i} with a long name ✓`, '$5.00'])
				}
			]
		});
		expect(pdf.byteLength).toBeGreaterThan(1000);
	});
});

describe.skipIf(!hasTestDb)('Tutora Pro', () => {
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

	const pilot = (on: boolean) => saveProSettings(db, { proPilotFreeTrial: on, proTrialDays: 14 });

	it('the Pro pilot (default ON) gives every tutor Pro; off → Free', async () => {
		const t = await makeUser(db, 'tutor', 'Pilot Tutor');
		expect(await proAccess(db, t.id, now)).toMatchObject({ active: true, pilot: true });
		await pilot(false);
		expect(await proAccess(db, t.id, now)).toMatchObject({ active: false, state: 'free' });
		expect(await tutorBrand(db, t.id)).toBeNull();
	});

	it('the Family settings form leaves the Pro switch alone, and the other way round', async () => {
		await pilot(false);
		await saveTutoraSettings(db, { pilotFreeTrial: true, trialDays: 30 });
		const t = await makeUser(db, 'tutor', 'Switch Tutor');
		expect((await proAccess(db, t.id, now)).active).toBe(false);
		await pilot(true);
		const parent = await makeUser(db, 'parent', 'Switch Parent', null);
		expect((await familyAccess(db, parent.id, now)).reason).toBe('pilot');
		await pilot(false);
	});

	it('one free trial when the pilot is off', async () => {
		await pilot(false);
		const t = await makeUser(db, 'tutor', 'Trial Tutor');
		expect((await proBilling(db, t.id, now)).canStartTrial).toBe(true);
		await startProTrial(db, t.id, now);
		expect(await proAccess(db, t.id, now)).toMatchObject({ active: true, state: 'trial' });
		await expect(startProTrial(db, t.id, now)).rejects.toThrow('fb_err_trial_used');
		expect((await proAccess(db, t.id, addDays(now, 15))).active).toBe(false);
	});

	it('invoice → proof → rejected → proof → paid with a P- receipt, then grace and Free', async () => {
		await pilot(false);
		const owner = await makeUser(db, 'owner', 'Owner');
		const t = await makeUser(db, 'tutor', 'Paying Tutor');
		const inv = await createProInvoice(db, t.id, 3, now);
		expect(inv.amountCents).toBe(1500);
		const owners: string[] = [];
		await submitProProof(
			db,
			t.id,
			inv.id,
			{ proofKey: 'proofs/p.png', reference: 'INN1', method: 'innbucks' },
			async (s) => {
				owners.push(s);
			},
			now
		);
		expect(owners).toHaveLength(1);
		const other = await makeUser(db, 'tutor', 'Other Tutor');
		await expect(
			submitProProof(db, other.id, inv.id, { proofKey: 'k', reference: null, method: 'bank' })
		).rejects.toThrow('err_not_found');
		await expect(rejectProInvoice(db, inv.id, ' ', notify, now)).rejects.toThrow('fb_err_reason');
		await rejectProInvoice(db, inv.id, 'Wrong amount', notify, now);
		expect(sent.at(-1)?.to).toBe(t.id);
		await submitProProof(db, t.id, inv.id, {
			proofKey: 'k2',
			reference: 'INN2',
			method: 'innbucks'
		});
		expect((await ownerProStats(db, now)).proofsWaiting).toBeGreaterThanOrEqual(1);
		const r = await confirmProInvoice(db, owner.id, inv.id, notify, now);
		expect(r.paidUntil.toISOString()).toBe(addMonths(now, 3).toISOString());
		await expect(confirmProInvoice(db, owner.id, inv.id, notify, now)).rejects.toThrow();
		expect(await proAccess(db, t.id, now)).toMatchObject({ active: true, state: 'paid' });
		const rec = await proReceiptData(db, inv.id, t.id);
		expect(rec?.number).toMatch(/^P-\d{6}$/);
		expect(rec?.tutorName).toBe('Tutora');
		expect(await proReceiptData(db, inv.id, other.id)).toBeNull();
		const stats = await ownerProStats(db, now);
		expect(stats.proTutors).toBeGreaterThanOrEqual(1);
		expect(stats.moneyThisMonthCents).toBeGreaterThanOrEqual(1500);
		// Pro branding now available
		await setProPrefs(db, t.id, { autoReminders: true, brandColour: '#123456' });
		expect((await tutorBrand(db, t.id))?.colour).toBe('#123456');
		// after the period: grace for 7 days, then Free (data kept)
		const end = r.paidUntil;
		expect((await proAccess(db, t.id, addDays(end, 3))).state).toBe('grace');
		expect((await proAccess(db, t.id, addDays(end, 8))).active).toBe(false);
		await runProBilling(db, notify, addDays(end, 1));
		await runProBilling(db, notify, addDays(end, 9));
		const [sub] = await db.select().from(proSubscription).where(eq(proSubscription.tutorId, t.id));
		expect(sub.status).toBe('free');
		expect(sub.brandColour).toBe('#123456');
	});

	it('the hourly job: next invoice a week before the end, each reminder once', async () => {
		await pilot(false);
		const t = await makeUser(db, 'tutor', 'Reminded Tutor');
		await db.insert(proSubscription).values({
			tutorId: t.id,
			status: 'active',
			paidUntil: addDays(now, 5),
			periodMonths: 1
		});
		sent.length = 0;
		await runProBilling(db, notify, now);
		const invs = await db.select().from(proInvoice).where(eq(proInvoice.tutorId, t.id));
		expect(invs).toHaveLength(1);
		expect(invs[0].amountCents).toBe(500);
		// 3 days before the due date: one reminder, not twice
		await runProBilling(db, notify, addDays(now, 3));
		await runProBilling(db, notify, addDays(now, 3));
		expect(sent.filter((s) => s.to === t.id)).toHaveLength(1);
		// due day, then 3 days after
		await runProBilling(db, notify, addDays(now, 5.1));
		await runProBilling(db, notify, addDays(now, 8.5));
		await runProBilling(db, notify, addDays(now, 8.6));
		expect(sent.filter((s) => s.to === t.id)).toHaveLength(3);
		const [inv] = await db.select().from(proInvoice).where(eq(proInvoice.tutorId, t.id));
		expect(inv.status).toBe('overdue');
	});

	it('owner gifts: Pro to a tutor, Family to a parent (covers the children), end date, remove', async () => {
		await pilot(false);
		await saveTutoraSettings(db, { pilotFreeTrial: false, trialDays: 0 });
		const owner = await makeUser(db, 'owner', 'Gift Owner');
		const t = await makeUser(db, 'tutor', 'Gift Tutor');
		const parent = await makeUser(db, 'parent', 'Gift Parent', null);
		const kid = await makeUser(db, 'student', 'Gift Kid', null);
		await db
			.update(profile)
			.set({ isUnder18: true, managed: true })
			.where(eq(profile.userId, kid.id));
		await db.insert(familyLink).values({ parentId: parent.id, studentId: kid.id, guardian: true });
		// the wrong plan for the role is refused
		await expect(giveGift(db, owner.id, { userId: t.id, plan: 'family' })).rejects.toThrow(
			'gift_err_role'
		);
		await expect(
			giveGift(db, owner.id, { userId: t.id, plan: 'pro', until: '2020-01-01' })
		).rejects.toThrow('gift_err_date');
		await giveGift(db, owner.id, { userId: t.id, plan: 'pro', note: 'Dad' });
		expect(await proAccess(db, t.id)).toMatchObject({ active: true, state: 'gift' });
		await giveGift(db, owner.id, { userId: parent.id, plan: 'family' });
		expect((await familyAccess(db, parent.id)).reason).toBe('gift');
		expect((await familyAccess(db, kid.id)).reason).toBe('gift');
		const list = await listGifts(db);
		expect(list.filter((g) => [t.id, parent.id].includes(g.userId))).toHaveLength(2);
		// an end date in the past no longer counts
		expect(await activeGift(db, 'pro', t.id, new Date('2100-01-01'))).not.toBeNull();
		await removeGift(db, list.find((g) => g.userId === t.id)!.id);
		expect((await proAccess(db, t.id)).active).toBe(false);
		await saveTutoraSettings(db, { pilotFreeTrial: true, trialDays: 30 });
	});

	it('Pro payment reminders: students and parents who owe, once a week, only when switched on', async () => {
		await pilot(false);
		const t = await makeUser(db, 'tutor', 'Owed Tutor');
		const s = await makeUser(db, 'student', 'Owing Student', t.id);
		const parent = await makeUser(db, 'parent', 'Owing Parent', null);
		await db.insert(familyLink).values({ parentId: parent.id, studentId: s.id, guardian: true });
		await db.insert(charge).values({
			tutorId: t.id,
			userId: s.id,
			kind: 'lesson',
			description: 'Maths lesson',
			amountCents: 1000,
			createdAt: addDays(now, -5)
		});
		sent.length = 0;
		// not Pro: nothing
		await db.insert(proSubscription).values({ tutorId: t.id, autoReminders: true });
		expect(await runTutorPayReminders(db, notify, now)).toBe(0);
		// Pro (paid) and switched on: student and parent are told, once a week
		await db
			.update(proSubscription)
			.set({ status: 'active', paidUntil: addDays(now, 20) })
			.where(eq(proSubscription.tutorId, t.id));
		expect(await runTutorPayReminders(db, notify, now)).toBe(2);
		expect(sent.map((x) => x.to).sort()).toEqual([s.id, parent.id].sort());
		expect(await runTutorPayReminders(db, notify, addDays(now, 3))).toBe(0);
		expect(await runTutorPayReminders(db, notify, addDays(now, 8))).toBe(2);
		// switched off: nothing
		await setProPrefs(db, t.id, { autoReminders: false });
		expect(await runTutorPayReminders(db, notify, addDays(now, 20))).toBe(0);
		// a hand-sent invoice; someone who owes nothing gets none
		expect(await sendTutorInvoice(db, notify, t.id, s.id, now)).toBe(2);
		const other = await makeUser(db, 'student', 'Paid Up', t.id);
		expect(await sendTutorInvoice(db, notify, t.id, other.id, now)).toBe(0);
	});

	it('student insights flag missing homework', async () => {
		const t = await makeUser(db, 'tutor', 'Insight Tutor');
		const s = await makeUser(db, 'student', 'Behind Student', t.id);
		const { homework } = await import('./db/app.schema.ts');
		for (const d of [-10, -6])
			await db.insert(homework).values({
				tutorId: t.id,
				userId: s.id,
				title: 'Worksheet',
				dueOn: addDays(new Date(), d).toISOString().slice(0, 10)
			});
		const rows = await studentInsights(db, t.id);
		const me = rows.find((r) => r.id === s.id)!;
		expect(me.homeworkMissing).toBe(2);
		expect(me.behind).toBe(true);
		expect(me.reasons).toContain('homework');
	});
});
