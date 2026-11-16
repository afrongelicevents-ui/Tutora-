/**
 * Owner side of Tutora Pro and of free plans given to chosen people:
 *   Money → Payments, "Tutora Pro" tab: ownerProLoad + ?/proConfirm ?/proReject
 *   System → Settings: ?/proSettings (Pro pilot switch, trial days), ?/giftGive ?/giftRemove
 */
import { fail } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { requireOwner } from './guards.ts';
import {
	confirmProInvoice,
	ownerProInvoices,
	ownerProStats,
	ProFail,
	proReceiptNumber,
	rejectProInvoice,
	saveProSettings
} from './pro.ts';
import { findPeople, giveGift, GiftFail, listGifts, removeGift } from './plan-gifts.ts';
import { TUTORA_INVOICE_STATUS, type TutoraInvoiceStatus } from './db/family.schema.ts';
import { fileLink } from './storage.ts';
import { notifyUser } from './notify.ts';
import { audit } from './owner.ts';
import type { Notify } from './notify-core.ts';
import { m } from '../paraglide/messages.js';

export async function ownerProLoad(event: RequestEvent) {
	requireOwner(event.locals.user, event.url);
	const raw = event.url.searchParams.get('pstatus') ?? 'open';
	const status: TutoraInvoiceStatus | 'open' | undefined =
		raw === 'all'
			? undefined
			: (TUTORA_INVOICE_STATUS as readonly string[]).includes(raw)
				? (raw as TutoraInvoiceStatus)
				: 'open';
	const [stats, rows] = await Promise.all([
		ownerProStats(event.locals.db),
		ownerProInvoices(event.locals.db, status)
	]);
	const invoices = await Promise.all(
		rows.map(async (r) => ({
			...r,
			receipt: r.receiptNo ? proReceiptNumber(r.receiptNo) : null,
			proofUrl: r.proofKey ? await fileLink(r.proofKey, `proof-pro-${r.id}`) : null,
			proofKey: undefined
		}))
	);
	return { pro: { stats, invoices, status: status ?? 'all' } };
}

const notifier =
	(event: RequestEvent): Notify =>
	(userId, subject, body, opts) =>
		notifyUser(event.locals.db, userId, subject, body, opts);

/** The owner's gifts list and, with ?gq=, people matching the search. */
export async function ownerGiftsLoad(event: RequestEvent) {
	requireOwner(event.locals.user, event.url);
	const q = (event.url.searchParams.get('gq') ?? '').trim();
	const [gifts, found] = await Promise.all([
		listGifts(event.locals.db),
		findPeople(event.locals.db, q)
	]);
	return { gifts: { list: gifts, q, found } };
}

export function ownerProActions() {
	return {
		proConfirm: async (event: RequestEvent) => {
			const u = requireOwner(event.locals.user, event.url);
			const id = Number((await event.request.formData()).get('id')) || 0;
			try {
				const r = await confirmProInvoice(event.locals.db, u.id, id, notifier(event));
				return { proConfirmed: proReceiptNumber(r.inv.receiptNo!) };
			} catch (e) {
				if (e instanceof ProFail) return fail(400, { proError: e.code });
				throw e;
			}
		},
		proReject: async (event: RequestEvent) => {
			requireOwner(event.locals.user, event.url);
			const fd = await event.request.formData();
			try {
				await rejectProInvoice(
					event.locals.db,
					Number(fd.get('id')) || 0,
					String(fd.get('reason') ?? ''),
					notifier(event)
				);
				return { proRejected: true };
			} catch (e) {
				if (e instanceof ProFail) return fail(400, { proError: e.code });
				throw e;
			}
		},
		proSettings: async (event: RequestEvent) => {
			const u = requireOwner(event.locals.user, event.url);
			const fd = await event.request.formData();
			await saveProSettings(event.locals.db, {
				proPilotFreeTrial: fd.get('proPilotFreeTrial') === 'on',
				proTrialDays: String(fd.get('proTrialDays') ?? '30')
			});
			await audit(event.locals.db, u.id, 'pro_settings_changed', null);
			return { proSaved: true };
		},
		giftGive: async (event: RequestEvent) => {
			const u = requireOwner(event.locals.user, event.url);
			const fd = await event.request.formData();
			const userId = String(fd.get('userId') ?? '');
			const plan = String(fd.get('plan') ?? '');
			try {
				await giveGift(event.locals.db, u.id, {
					userId,
					plan,
					until: String(fd.get('until') ?? '') || null,
					note: String(fd.get('note') ?? '')
				});
			} catch (e) {
				if (e instanceof GiftFail) return fail(400, { giftError: e.code });
				throw e;
			}
			await audit(event.locals.db, u.id, 'plan_gift_given', userId);
			await notifyUser(
				event.locals.db,
				userId,
				m.gift_s(),
				plan === 'pro' ? m.gift_b_pro() : m.gift_b_family(),
				{ kind: 'account', link: plan === 'pro' ? '/tutor/pro' : '/parent/plans' }
			);
			return { giftSaved: true };
		},
		giftRemove: async (event: RequestEvent) => {
			const u = requireOwner(event.locals.user, event.url);
			const fd = await event.request.formData();
			if (fd.get('sure') !== 'on') return fail(400, { giftError: 'err_tick_sure' });
			await removeGift(event.locals.db, Number(fd.get('id')) || 0);
			await audit(event.locals.db, u.id, 'plan_gift_removed', null);
			return { giftRemoved: true };
		}
	};
}
