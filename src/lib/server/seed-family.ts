/**
 * TEST SITE ONLY (called from seedTestData, which only runs with TEST_SITE=1): fake Tutora
 * Family data. Fake payment details, families with 1, 3 and 4 children, and invoices in every
 * status, so the owner and parent pages have something to show. Nothing here runs on live.
 */
import { eq } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { account, user } from './db/auth.schema.ts';
import { profile } from './db/app.schema.ts';
import { familyLink } from './db/v3.schema.ts';
import { familySubscription, subscriptionChild, tutoraInvoice } from './db/family.schema.ts';
import { planGift } from './db/pro.schema.ts';
import { DbStore } from './db-store.ts';
import { saveTutoraSettings, addMonths } from './family-billing.ts';
import { quote } from '../family-pricing.ts';
import { addDays } from '../tz.ts';
import type { TestLogin } from './seed.ts';

/** the same discounts as the fake settings below, so invoices follow the price table */
const DISCOUNTS = { discount3mPct: 5, discount6mPct: 10 };

export async function seedFamilyBilling(
	db: DB,
	hash: string,
	logins: TestLogin[],
	now = new Date()
) {
	// obviously fake details (TEST). The pilot switch is OFF here (on live it starts ON) so the
	// paying flows can be seen; everyone the walkthroughs use is given Family free below.
	await saveTutoraSettings(db, {
		ecocashNumber: '0770 000 000 (TEST)',
		ecocashName: 'Tutora TEST',
		innbucksNumber: '0780 000 000 (TEST)',
		innbucksName: 'Tutora TEST',
		bankName: 'Test Bank',
		bankAccountName: 'Tutora TEST',
		bankAccountNumber: '0000 0000 0000 (TEST)',
		bankBranch: 'Test branch',
		notes: 'Test site: these are not real payment details.',
		...DISCOUNTS,
		pilotFreeTrial: false,
		trialDays: 14
	});

	const idOf = async (email: string) => {
		const [u] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
		return u?.id ?? null;
	};
	const [owner] = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.role, 'owner'))
		.limit(1);

	async function parentWithKids(name: string, email: string, kids: string[]) {
		const id = `test_${email.split('@')[0].replace(/[^a-z0-9]/g, '_')}`;
		await db.insert(user).values({ id, name, email, emailVerified: true, role: 'parent' });
		await db.insert(profile).values({ userId: id, phone: '+263773000098', consentAt: now });
		await db.insert(account).values({
			id: `acc_${id}`,
			userId: id,
			accountId: id,
			providerId: 'credential',
			password: hash
		});
		logins.push({ role: 'parent', name: `${name} (${kids.length} children)`, email });
		const ids: { id: string; name: string }[] = [];
		for (const [i, kid] of kids.entries()) {
			const kidId = `${id}_kid${i + 1}`;
			// younger children made by the parent (no login of their own)
			await db.insert(user).values({
				id: kidId,
				name: kid,
				email: `${kidId}@kids.tutora.invalid`,
				emailVerified: true,
				role: 'student'
			});
			await db.insert(profile).values({
				userId: kidId,
				isUnder18: true,
				managed: true,
				consentAt: now,
				level: 'Grade 6'
			});
			await db
				.insert(familyLink)
				.values({ parentId: id, studentId: kidId, guardian: true, status: 'active' });
			ids.push({ id: kidId, name: kid });
		}
		return { id, kids: ids };
	}

	/** a 1×1 picture standing in for a payment screenshot, so "View proof" has something */
	async function fakeProof(key: string) {
		const png = Uint8Array.from(
			atob(
				'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
			),
			(c) => c.charCodeAt(0)
		);
		await new DbStore(db).put(key, png, 'image/png');
		return key;
	}

	let receipt = 0;
	async function invoice(
		parentId: string,
		subId: number,
		kids: { id: string; name: string }[],
		period: number,
		status: 'due' | 'proof_sent' | 'paid' | 'overdue' | 'rejected' | 'cancelled',
		dueOn: Date,
		extra: Partial<typeof tutoraInvoice.$inferInsert> = {}
	) {
		const q = quote(kids.length, period, DISCOUNTS);
		const paid = status === 'paid';
		await db.insert(tutoraInvoice).values({
			parentId,
			subscriptionId: subId,
			children: kids.map((k, i) => ({ id: k.id, name: k.name, cents: q.perChildCents[i] })),
			periodMonths: q.period,
			amountCents: q.totalCents,
			discountPct: q.discountPct,
			status,
			dueOn,
			periodStart: dueOn,
			remindedBefore: now,
			...(paid
				? {
						receiptNo: ++receipt,
						method: 'ecocash' as const,
						reference: `TEST-ECO-${receipt}`,
						confirmedBy: owner?.id ?? null,
						confirmedAt: dueOn,
						proofKey: null
					}
				: {}),
			...extra
		});
	}
	async function subscription(
		parentId: string,
		status: 'active' | 'grace' | 'free',
		paidUntil: Date | null,
		covered: string[]
	) {
		const [s] = await db
			.insert(familySubscription)
			.values({ parentId, status, paidUntil, periodMonths: 1 })
			.returning();
		if (covered.length)
			await db.insert(subscriptionChild).values(
				covered.map((studentId) => ({
					subscriptionId: s.id,
					studentId,
					active: status !== 'free'
				}))
			);
		return s.id;
	}

	// 1 child: Mrs Sibanda has paid (receipt), active for 3 more weeks
	const sibanda = await idOf('sibanda@example.com');
	const tatenda = await idOf('tatenda@example.com');
	if (sibanda && tatenda) {
		const kids = [{ id: tatenda, name: 'Tatenda Sibanda' }];
		const sub = await subscription(sibanda, 'active', addDays(now, 21), [tatenda]);
		await invoice(sibanda, sub, kids, 1, 'paid', addDays(now, -9));
	}
	// Mr Banda has sent proof for Rudo: waiting for the owner
	const banda = await idOf('banda@example.com');
	const rudo = await idOf('rudo@example.com');
	if (banda && rudo) {
		const sub = await subscription(banda, 'free', null, []);
		await invoice(
			banda,
			sub,
			[{ id: rudo, name: 'Rudo Banda' }],
			3,
			'proof_sent',
			addDays(now, 2),
			{
				method: 'innbucks',
				reference: 'TEST-INN-0042',
				proofKey: await fakeProof(`proofs/tutora/${banda}/test-proof.png`)
			}
		);
	}
	// 3 children: an invoice due now, an older one rejected and one cancelled
	const p3 = await parentWithKids('Mrs Rutendo Mhlanga', 'parent3@example.com', [
		'Tino Mhlanga',
		'Tanaka Mhlanga',
		'Tadiwa Mhlanga'
	]);
	{
		const sub = await subscription(p3.id, 'free', null, []);
		await invoice(p3.id, sub, p3.kids, 1, 'cancelled', addDays(now, -20));
		await invoice(p3.id, sub, p3.kids, 1, 'rejected', addDays(now, -10), {
			rejectReason: 'The amount on the proof does not match the invoice (TEST).',
			method: 'bank',
			reference: 'TEST-BANK-7'
		});
		await invoice(p3.id, sub, p3.kids, 1, 'due', addDays(now, 3));
	}
	// 4 children (flagged for the owner): paid last month, now overdue and in the 7-day grace
	const p4 = await parentWithKids('Mr Farai Ncube', 'parent4@example.com', [
		'Rumbi Ncube',
		'Kudzai Ncube',
		'Nyasha Ncube',
		'Tapiwa Ncube'
	]);
	{
		const ended = addDays(now, -4);
		const sub = await subscription(
			p4.id,
			'grace',
			ended,
			p4.kids.map((k) => k.id)
		);
		await invoice(p4.id, sub, p4.kids, 1, 'paid', addMonths(ended, -1));
		await invoice(p4.id, sub, p4.kids, 1, 'overdue', ended, { remindedDue: ended });
	}

	// Family free (an owner gift) for the other test families and the students without a
	// parent, so their pages work with the pilot switch off. Banda (proof waiting), the
	// 3-children family (due) and the 4-children family (overdue) show the paying flows.
	for (const email of [
		'ruth@example.com',
		'grace@example.com',
		'peter@example.com',
		'blessing@example.com',
		'chiedza@example.com',
		'fadzai@example.com',
		'kuda@example.com',
		'panashe@example.com',
		'simba@example.com',
		'tinashe@example.com',
		'tsitsi@example.com',
		'vimbai@example.com'
	]) {
		const id = await idOf(email);
		if (id)
			await db
				.insert(planGift)
				.values({ userId: id, plan: 'family', note: 'Test site', givenBy: owner?.id ?? null })
				.onConflictDoNothing();
	}
}
