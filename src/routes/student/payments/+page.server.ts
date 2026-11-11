import { fail, redirect } from '@sveltejs/kit';
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
import { myTutor, tutorsForUser } from '#lib/server/people.ts';
import { requireRole } from '#lib/server/guards.ts';
import { getStore } from '#lib/server/storage.ts';
import { DOC_KINDS, MB, newKey, readUpload } from '#lib/server/files.ts';
import { hitLimit } from '#lib/server/rate-limit.ts';
import { notifyTutor } from '#lib/server/notify.ts';
import { formObject } from '#lib/validation/auth.ts';
import { formatMoney, parseMoney } from '#lib/money.ts';
import { isIsoDate, localDate } from '#lib/tz.ts';
import { m } from '#lib/paraglide/messages.js';

export const load: PageServerLoad = async ({ locals, url }) => {
	requireRole(locals.user, url, ['student', 'parent']);
	const u = locals.user!;
	const tutors = await tutorsForUser(locals.db, u.id);
	const tutor = await myTutor(locals.db, u.id, url.searchParams.get('tutor'));
	// no tutor yet: nothing to pay (the student area explains how to find one)
	if (!tutor) redirect(303, '/student');
	const t = tutor.tutorId;
	const [s, balance, payments, mine, offers] = await Promise.all([
		getSettings(locals.db, t),
		balanceFor(locals.db, t, u.id),
		paymentsForUser(locals.db, u.id, t),
		packagesForUser(locals.db, u.id, t),
		tutor.status === 'active' ? listPackages(locals.db, t) : []
	]);
	return {
		tutor: { slug: tutor.slug, name: tutor.name, active: tutor.status === 'active' },
		tutors: tutors.map((x) => ({ slug: x.slug, name: x.name })),
		tab: ['cash', 'history', 'packages'].includes(url.searchParams.get('tab') ?? '')
			? url.searchParams.get('tab')!
			: 'pay',
		currency: s.currency,
		// a tutor's payment details only while they are approved
		details:
			tutor.status === 'active'
				? paymentDetails(s)
				: { bank: null, ecocash: null, innbucks: null, note: null, cash: false },
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
		const tutor = await myTutor(locals.db, u.id, url.searchParams.get('tutor'));
		if (!tutor) return fail(404, { error: 'err_not_found' });
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
		const row = await submitPayment(locals.db, tutor.tutorId, u.id, {
			amountCents: cents,
			method: p.data.method,
			reference: p.data.reference,
			paidOn: p.data.date,
			proofKey: key
		});
		await notifyTutor(
			locals.db,
			tutor.tutorId,
			m.email_pay_new_s(),
			m.email_pay_new_b({
				name: u.name,
				amount: formatMoney(cents, row.currency),
				method: p.data.method,
				ref: p.data.reference
			})
		);
		return { done: 'sent' };
	},
	cash: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['student', 'parent']);
		const tutor = await myTutor(locals.db, u.id, url.searchParams.get('tutor'));
		if (!tutor) return fail(404, { error: 'err_not_found' });
		const limit = await hitLimit(locals.db, 'upload', u.id);
		if (!limit.ok)
			return fail(429, {
				error: 'err_rate_limited',
				minutes: Math.ceil(limit.retryAfterSeconds / 60)
			});
		// only for tutors who take cash
		if (tutor.status !== 'active' || !(await getSettings(locals.db, tutor.tutorId)).acceptsCash)
			return fail(400, { error: 'err_no_cash' });
		const f = formObject(await request.formData());
		const cents = parseMoney(f.amount ?? '');
		if (!cents) return fail(400, { error: 'err_money' });
		const date =
			isIsoDate(f.date ?? '') && f.date <= localDate(new Date()) ? f.date : localDate(new Date());
		const row = await submitPayment(locals.db, tutor.tutorId, u.id, {
			amountCents: cents,
			method: 'cash',
			reference: null,
			paidOn: date,
			proofKey: null
		});
		await notifyTutor(
			locals.db,
			tutor.tutorId,
			m.email_cash_new_s(),
			m.email_cash_new_b({ name: u.name, amount: formatMoney(cents, row.currency), date })
		);
		return { done: 'cash' };
	},
	buy: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['student', 'parent']);
		const tutor = await myTutor(locals.db, u.id, url.searchParams.get('tutor'));
		if (!tutor) return fail(404, { error: 'err_not_found' });
		const f = formObject(await request.formData());
		try {
			const sp = await buyPackage(locals.db, tutor.tutorId, u.id, Number(f.id) || 0);
			await notifyTutor(
				locals.db,
				tutor.tutorId,
				m.email_pkg_s(),
				m.email_pkg_b({ name: u.name, pkg: sp.name })
			);
		} catch (e) {
			if (e instanceof BillingFail) return fail(400, { error: e.code });
			throw e;
		}
		return { done: 'package' };
	}
};
