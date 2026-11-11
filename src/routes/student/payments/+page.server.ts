import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import {
	balanceFor,
	BillingFail,
	buyPackage,
	packagesForUser,
	paymentsForUser,
	receiptNumber,
	submitPayment
} from '#lib/server/billing.ts';
import { getSettings, listPackages, paymentDetails } from '#lib/server/settings.ts';
import { requireRole } from '#lib/server/guards.ts';
import { getStore } from '#lib/server/storage.ts';
import { DOC_KINDS, MB, newKey, readUpload } from '#lib/server/files.ts';
import { hitLimit } from '#lib/server/rate-limit.ts';
import { notifyTutor } from '#lib/server/notify.ts';
import { formObject } from '#lib/validation/auth.ts';
import { formatMoney, parseMoney } from '#lib/money.ts';
import { isIsoDate, localDate } from '#lib/tz.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	const u = locals.user!;
	const [s, balance, payments, mine, offers] = await Promise.all([
		getSettings(locals.db),
		balanceFor(locals.db, u.id),
		paymentsForUser(locals.db, u.id),
		packagesForUser(locals.db, u.id),
		listPackages(locals.db)
	]);
	return {
		tab: ['cash', 'history', 'packages'].includes(url.searchParams.get('tab') ?? '')
			? url.searchParams.get('tab')!
			: 'pay',
		currency: s.currency,
		details: paymentDetails(s),
		balance,
		today: localDate(new Date()),
		payments: payments.map((p) => ({
			...p,
			receipt: p.receiptNo ? receiptNumber(p.receiptNo) : null
		})),
		mine,
		offers
	};
};

const paySchema = z.object({
	amount: z.string(),
	method: z.enum(['bank', 'ecocash', 'innbucks', 'other']),
	reference: z.string().trim().min(2, 'err_ref').max(60, 'err_too_long'),
	date: z.string().refine(isIsoDate, 'err_times')
});

export const actions: Actions = {
	pay: async ({ locals, url, request, platform }) => {
		const u = requireRole(locals.user, url, ['student', 'parent']);
		const limit = await hitLimit(locals.db, 'upload', u.id);
		if (!limit.ok)
			return fail(429, {
				error: 'err_rate_limited',
				minutes: Math.ceil(limit.retryAfterSeconds / 60)
			});
		const data = await request.formData();
		const p = paySchema.safeParse(formObject(data));
		const cents = parseMoney(String(data.get('amount') ?? ''));
		if (!p.success) return fail(400, { error: p.error.issues[0].message });
		if (!cents) return fail(400, { error: 'err_money' });
		if (p.data.date > localDate(new Date())) return fail(400, { error: 'err_future_date' });
		const proof = await readUpload(data.get('proof'), {
			maxBytes: 3 * MB,
			allowed: DOC_KINDS,
			required: true
		});
		if (!proof?.ok) return fail(400, { error: proof?.error ?? 'err_file_missing' });
		const key = newKey(`proofs/${u.id}`, proof.ext);
		await getStore(platform).put(key, proof.bytes, proof.kind);
		const row = await submitPayment(locals.db, u.id, {
			amountCents: cents,
			method: p.data.method,
			reference: p.data.reference,
			paidOn: p.data.date,
			proofKey: key
		});
		await notifyTutor(
			locals.db,
			'Payment to confirm',
			`${u.name} says they paid ${formatMoney(cents, row.currency)} (${p.data.method}, ref ${p.data.reference}). Open Tutora to check the proof and confirm or reject.`
		);
		return { done: 'sent' };
	},
	cash: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['student', 'parent']);
		const limit = await hitLimit(locals.db, 'upload', u.id);
		if (!limit.ok)
			return fail(429, {
				error: 'err_rate_limited',
				minutes: Math.ceil(limit.retryAfterSeconds / 60)
			});
		const f = formObject(await request.formData());
		const cents = parseMoney(f.amount ?? '');
		if (!cents) return fail(400, { error: 'err_money' });
		const date =
			isIsoDate(f.date ?? '') && f.date <= localDate(new Date()) ? f.date : localDate(new Date());
		const row = await submitPayment(locals.db, u.id, {
			amountCents: cents,
			method: 'cash',
			reference: null,
			paidOn: date,
			proofKey: null
		});
		await notifyTutor(
			locals.db,
			'Cash payment to confirm',
			`${u.name} says they paid you ${formatMoney(cents, row.currency)} in cash on ${date}. Open Tutora to confirm.`
		);
		return { done: 'cash' };
	},
	buy: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['student', 'parent']);
		const f = formObject(await request.formData());
		try {
			const sp = await buyPackage(locals.db, u.id, Number(f.id) || 0);
			await notifyTutor(locals.db, 'Package chosen', `${u.name} chose the package "${sp.name}".`);
		} catch (e) {
			if (e instanceof BillingFail) return fail(400, { error: e.code });
			throw e;
		}
		return { done: 'package' };
	}
};
