/** Page loads and form actions for the tutor's Tutora Pro pages (/tutor/pro/…). */
import { error, fail, redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { requireTutor } from './guards.ts';
import {
	createProInvoice,
	myProInvoice,
	proBilling,
	ProFail,
	proReceiptData,
	setProPrefs,
	startProTrial,
	submitProProof
} from './pro.ts';
import { hasPaymentDetails } from './family-billing.ts';
import { getStore } from './storage.ts';
import { DOC_KINDS, MB, newKey, readUpload } from './files.ts';
import { hitLimit } from './rate-limit.ts';
import { notifyOwners } from './notify.ts';
import { receiptPdf } from './pdf.ts';
import { proQuote, PRO_FEATURES, type ProFeature } from '../pro-pricing.ts';

export async function proLoad(event: RequestEvent) {
	const u = requireTutor(event.locals.user, event.url);
	const b = await proBilling(event.locals.db, u.id);
	const s = b.settings;
	const lockedRaw = event.url.searchParams.get('locked') ?? '';
	const locked = (PRO_FEATURES as readonly string[]).includes(lockedRaw)
		? (lockedRaw as ProFeature)
		: null;
	const invId = Number(event.url.searchParams.get('invoice')) || 0;
	const invoice = invId ? (b.invoices.find((i) => i.id === invId) ?? null) : null;
	return {
		locked,
		access: b.access,
		state: b.state,
		canStartTrial: b.canStartTrial,
		trialDays: s.proTrialDays,
		pilot: s.proPilotFreeTrial,
		prices: [1, 3, 6].map((p) => proQuote(p, s)),
		prefs: {
			autoReminders: b.subscription?.autoReminders ?? false,
			brandColour: b.subscription?.brandColour ?? ''
		},
		details: hasPaymentDetails(s)
			? {
					ecocashNumber: s.ecocashNumber,
					ecocashName: s.ecocashName,
					innbucksNumber: s.innbucksNumber,
					innbucksName: s.innbucksName,
					bankName: s.bankName,
					bankAccountName: s.bankAccountName,
					bankAccountNumber: s.bankAccountNumber,
					bankBranch: s.bankBranch,
					notes: s.notes
				}
			: null,
		invoices: b.invoices.map((i) => ({
			id: i.id,
			children: ['Tutora Pro'],
			periodMonths: i.periodMonths,
			amountCents: i.amountCents,
			discountPct: i.discountPct,
			status: i.status,
			dueOn: i.dueOn,
			rejectReason: i.rejectReason,
			receiptNo: i.receiptNo,
			createdAt: i.createdAt
		})),
		invoice: invoice
			? {
					id: invoice.id,
					amountCents: invoice.amountCents,
					status: invoice.status,
					dueOn: invoice.dueOn,
					periodMonths: invoice.periodMonths,
					rejectReason: invoice.rejectReason
				}
			: null,
		sent: event.url.searchParams.has('sent')
	};
}

const failFrom = (e: unknown) => {
	if (e instanceof ProFail) return fail(400, { error: e.code });
	throw e;
};

export const proActions = {
	trial: async (event: RequestEvent) => {
		const u = requireTutor(event.locals.user, event.url);
		try {
			await startProTrial(event.locals.db, u.id);
		} catch (e) {
			return failFrom(e);
		}
		return { trial: true };
	},
	invoice: async (event: RequestEvent) => {
		const u = requireTutor(event.locals.user, event.url);
		const fd = await event.request.formData();
		let id: number;
		try {
			id = (await createProInvoice(event.locals.db, u.id, Number(fd.get('period')))).id;
		} catch (e) {
			return failFrom(e);
		}
		redirect(303, `/tutor/pro/checkout?invoice=${id}`);
	},
	prefs: async (event: RequestEvent) => {
		const u = requireTutor(event.locals.user, event.url);
		const fd = await event.request.formData();
		await setProPrefs(event.locals.db, u.id, {
			autoReminders: fd.get('autoReminders') === 'on',
			brandColour: String(fd.get('brandColour') ?? '')
		});
		return { prefsSaved: true };
	},
	proof: async (event: RequestEvent) => {
		const u = requireTutor(event.locals.user, event.url);
		const limit = await hitLimit(event.locals.db, 'upload', u.id);
		if (!limit.ok) return fail(429, { error: 'err_rate_limited' });
		const fd = await event.request.formData();
		const id = Number(fd.get('invoice')) || 0;
		if (!(await myProInvoice(event.locals.db, u.id, id)))
			return fail(404, { error: 'err_not_found' });
		const proof = await readUpload(fd.get('proof'), {
			maxBytes: 5 * MB,
			allowed: DOC_KINDS,
			required: true
		});
		if (!proof?.ok) return fail(400, { error: proof?.error ?? 'fb_err_proof', invoice: id });
		const key = newKey(`proofs/tutora/${u.id}`, proof.ext);
		await getStore(event.platform).put(key, proof.bytes, proof.kind);
		try {
			await submitProProof(
				event.locals.db,
				u.id,
				id,
				{
					proofKey: key,
					reference: String(fd.get('reference') ?? ''),
					method: String(fd.get('method') ?? 'other')
				},
				(s, b) => notifyOwners(event.locals.db, s, b, '/owner/payments?view=pro')
			);
		} catch (e) {
			return failFrom(e);
		}
		redirect(303, '/tutor/pro/billing?sent=1');
	}
};

export async function proReceipt(event: RequestEvent, id: number) {
	const u = requireTutor(event.locals.user, event.url);
	const r = await proReceiptData(event.locals.db, id, u.id);
	if (!r) error(404, 'Not found');
	return new Response((await receiptPdf(r)) as BodyInit, {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `attachment; filename="tutora-receipt-${r.number}.pdf"`,
			'cache-control': 'private, no-store'
		}
	});
}
