/**
 * Page loads and form actions for Tutora Family (Plans, Checkout, Billing), shared by the
 * parent pages and the adult student's own page (/student/upgrade).
 */
import { error, fail, redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { requireRole } from './guards.ts';
import {
	createCheckoutInvoice,
	FamilyBillingFail,
	familyBilling,
	hasPaymentDetails,
	myInvoice,
	startTrial,
	submitProof,
	tutoraReceiptData
} from './family-billing.ts';
import { getStore } from './storage.ts';
import { DOC_KINDS, MB, newKey, readUpload } from './files.ts';
import { hitLimit } from './rate-limit.ts';
import { notifyOwners } from './notify.ts';
import { receiptPdf } from './pdf.ts';
import { familyFeatureFor, FAMILY_FEATURES, type FamilyFeature } from '../family-features.ts';

type Role = 'parent' | 'student';

export async function familyLoad(event: RequestEvent, roles: Role[]) {
	const u = requireRole(event.locals.user, event.url, roles);
	const b = await familyBilling(event.locals.db, u.id);
	const lockedRaw = event.url.searchParams.get('locked') ?? '';
	const locked = (Object.values(FAMILY_FEATURES) as string[]).includes(lockedRaw)
		? (lockedRaw as FamilyFeature)
		: null;
	const invId = Number(event.url.searchParams.get('invoice')) || 0;
	const invoice = invId ? (b.invoices.find((i) => i.id === invId) ?? null) : null;
	const s = b.settings;
	return {
		locked,
		access: b.access,
		state: b.state,
		canStartTrial: b.canStartTrial,
		trialDays: s.trialDays,
		pilot: s.pilotFreeTrial,
		discounts: { discount3mPct: s.discount3mPct, discount6mPct: s.discount6mPct },
		// only what a family needs to pay: never anything else from the settings
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
		children: b.children,
		invoices: b.invoices.map((i) => ({
			id: i.id,
			children: i.children.map((c) => c.name),
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
					children: invoice.children.map((c) => c.name),
					rejectReason: invoice.rejectReason
				}
			: null
	};
}

const failFrom = (e: unknown) => {
	if (e instanceof FamilyBillingFail) return fail(400, { error: e.code });
	throw e;
};

/** where a payer's pages live */
const base = (role: string) => (role === 'parent' ? '/parent' : '/student/upgrade');

export function familyActions(roles: Role[]) {
	return {
		trial: async (event: RequestEvent) => {
			const u = requireRole(event.locals.user, event.url, roles);
			try {
				await startTrial(event.locals.db, u.id);
			} catch (e) {
				return failFrom(e);
			}
			return { trial: true };
		},
		/** checkout: chosen children + period → an invoice, then the payment step */
		invoice: async (event: RequestEvent) => {
			const u = requireRole(event.locals.user, event.url, roles);
			const fd = await event.request.formData();
			const ids = fd.getAll('child').map(String);
			let id: number;
			try {
				const inv = await createCheckoutInvoice(
					event.locals.db,
					u.id,
					u.role === 'student' ? [u.id] : ids,
					Number(fd.get('period'))
				);
				id = inv.id;
			} catch (e) {
				return failFrom(e);
			}
			redirect(
				303,
				u.role === 'parent' ? `/parent/checkout?invoice=${id}` : `/student/upgrade?invoice=${id}`
			);
		},
		/** proof of payment for an invoice */
		proof: async (event: RequestEvent) => {
			const u = requireRole(event.locals.user, event.url, roles);
			const limit = await hitLimit(event.locals.db, 'upload', u.id);
			if (!limit.ok) return fail(429, { error: 'err_rate_limited' });
			const fd = await event.request.formData();
			const id = Number(fd.get('invoice')) || 0;
			const inv = await myInvoice(event.locals.db, u.id, id);
			if (!inv) return fail(404, { error: 'err_not_found' });
			const proof = await readUpload(fd.get('proof'), {
				maxBytes: 5 * MB,
				allowed: DOC_KINDS,
				required: true
			});
			if (!proof?.ok) return fail(400, { error: proof?.error ?? 'fb_err_proof', invoice: id });
			const key = newKey(`proofs/tutora/${u.id}`, proof.ext);
			await getStore(event.platform).put(key, proof.bytes, proof.kind);
			try {
				await submitProof(
					event.locals.db,
					u.id,
					id,
					{
						proofKey: key,
						reference: String(fd.get('reference') ?? ''),
						method: String(fd.get('method') ?? 'other')
					},
					(s, b) => notifyOwners(event.locals.db, s, b, '/owner/payments')
				);
			} catch (e) {
				return failFrom(e);
			}
			redirect(303, `${base(u.role)}${u.role === 'parent' ? '/billing' : ''}?sent=1`);
		}
	};
}

/** The Tutora receipt PDF for the payer's own paid invoice. */
export async function familyReceipt(event: RequestEvent, roles: Role[], id: number) {
	const u = requireRole(event.locals.user, event.url, roles);
	const r = await tutoraReceiptData(event.locals.db, id, u.id);
	if (!r) error(404, 'Not found');
	return new Response((await receiptPdf(r)) as BodyInit, {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `attachment; filename="tutora-receipt-${r.number}.pdf"`,
			'cache-control': 'private, no-store'
		}
	});
}

export { familyFeatureFor };
