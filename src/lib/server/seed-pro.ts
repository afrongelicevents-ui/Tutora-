/**
 * TEST SITE ONLY (called from seedTestData, which only runs with TEST_SITE=1): fake Tutora
 * Pro data, so both a Pro and a Free tutor can be walked through:
 *   chipo@example.com  Pro, paid (receipt P-000001), automatic payment reminders on
 *   tendai@example.com Free (never paid): Pro features show "Pro" + Upgrade
 *   farai@example.com  Free, sent proof for Pro: waits in Owner → Payments → Tutora Pro
 * The Pro pilot switch is OFF on the test site so Free and Pro look different; on live it
 * stays ON (every tutor has Pro free) until the owner turns it off.
 */
import { eq } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { user } from './db/auth.schema.ts';
import { proInvoice, proSubscription } from './db/pro.schema.ts';
import { saveProSettings } from './pro.ts';
import { addMonths } from './family-billing.ts';
import { addDays } from '../tz.ts';
import { proQuote } from '../pro-pricing.ts';
import { DbStore } from './db-store.ts';
import type { TestLogin } from './seed.ts';

export async function seedProPlans(db: DB, logins: TestLogin[], now = new Date()) {
	await saveProSettings(db, { proPilotFreeTrial: false, proTrialDays: 14 });
	const idOf = async (email: string) => {
		const [u] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
		return u?.id ?? null;
	};
	const [owner] = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.role, 'owner'))
		.limit(1);

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

	const chipo = await idOf('chipo@example.com');
	if (chipo) {
		const paidOn = addDays(now, -10);
		const [s] = await db
			.insert(proSubscription)
			.values({
				tutorId: chipo,
				status: 'active',
				paidUntil: addMonths(paidOn, 1),
				periodMonths: 1,
				autoReminders: true,
				brandColour: '#1f5fa8'
			})
			.returning();
		await db.insert(proInvoice).values({
			tutorId: chipo,
			subscriptionId: s.id,
			periodMonths: 1,
			amountCents: 500,
			status: 'paid',
			dueOn: paidOn,
			periodStart: paidOn,
			method: 'ecocash',
			reference: 'TEST-PRO-1',
			receiptNo: 1,
			confirmedBy: owner?.id ?? null,
			confirmedAt: paidOn,
			remindedBefore: paidOn
		});
	}
	const farai = await idOf('farai@example.com');
	if (farai) {
		const [s] = await db
			.insert(proSubscription)
			.values({ tutorId: farai, status: 'free', periodMonths: 3 })
			.returning();
		await db.insert(proInvoice).values({
			tutorId: farai,
			subscriptionId: s.id,
			periodMonths: 3,
			// the price table with the test discounts (5% for 3 months)
			amountCents: proQuote(3, { discount3mPct: 5, discount6mPct: 10 }).totalCents,
			discountPct: 5,
			status: 'proof_sent',
			dueOn: addDays(now, 2),
			periodStart: now,
			method: 'innbucks',
			reference: 'TEST-PRO-2',
			proofKey: await fakeProof(`proofs/tutora/${farai}/test-pro-proof.png`),
			remindedBefore: now
		});
	}
	// say which tutor is which on the test-site login list
	for (const l of logins) {
		if (l.email === 'chipo@example.com') l.name += ' (Tutora Pro)';
		if (l.email === 'tendai@example.com' || l.email === 'farai@example.com') l.name += ' (Free)';
	}
}
