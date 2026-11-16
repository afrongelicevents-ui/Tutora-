/**
 * Owner side of Tutora Family, ready to wire into an owner page (the owner area is being
 * redesigned separately):
 *
 *   // +page.server.ts
 *   export const load = (e) => ownerFamilyLoad(e);
 *   export const actions = ownerFamilyActions();   // ?/familySettings ?/familyConfirm ?/familyReject
 *
 *   // +page.svelte
 *   <OwnerFamilyStats stats={data.family.stats} />
 *   <OwnerFamilySettings settings={data.family.settings} saved={form?.familySaved} />
 *   <OwnerFamilyInvoices invoices={data.family.invoices} />
 */
import { fail } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { requireOwner } from './guards.ts';
import {
	confirmInvoice,
	FamilyBillingFail,
	getTutoraSettings,
	ownerFamilyStats,
	ownerInvoices,
	rejectInvoice,
	saveTutoraSettings,
	tutoraReceiptNumber
} from './family-billing.ts';
import { TUTORA_INVOICE_STATUS, type TutoraInvoiceStatus } from './db/family.schema.ts';
import { fileLink } from './storage.ts';
import { notifyUser } from './notify.ts';
import { formObject } from '../validation/auth.ts';
import type { Notify } from './notify-core.ts';

export async function ownerFamilyLoad(event: RequestEvent) {
	requireOwner(event.locals.user, event.url);
	const raw = event.url.searchParams.get('fstatus') ?? 'open';
	const status: TutoraInvoiceStatus | 'open' | undefined =
		raw === 'all'
			? undefined
			: (TUTORA_INVOICE_STATUS as readonly string[]).includes(raw)
				? (raw as TutoraInvoiceStatus)
				: 'open';
	const [settings, stats, rows] = await Promise.all([
		getTutoraSettings(event.locals.db),
		ownerFamilyStats(event.locals.db),
		ownerInvoices(event.locals.db, status)
	]);
	const invoices = await Promise.all(
		rows.map(async (r) => ({
			...r,
			children: r.children.map((c) => c.name),
			receipt: r.receiptNo ? tutoraReceiptNumber(r.receiptNo) : null,
			proofUrl: r.proofKey ? await fileLink(r.proofKey, `proof-${r.id}`) : null,
			proofKey: undefined
		}))
	);
	return { family: { settings, stats, invoices, status: status ?? 'all' } };
}

const notifier =
	(event: RequestEvent): Notify =>
	(userId, subject, body, opts) =>
		notifyUser(event.locals.db, userId, subject, body, opts);

export function ownerFamilyActions() {
	return {
		familySettings: async (event: RequestEvent) => {
			requireOwner(event.locals.user, event.url);
			const f = formObject(await event.request.formData());
			await saveTutoraSettings(event.locals.db, {
				...f,
				pilotFreeTrial: f.pilotFreeTrial === 'on'
			});
			return { familySaved: true };
		},
		familyConfirm: async (event: RequestEvent) => {
			const u = requireOwner(event.locals.user, event.url);
			const id = Number((await event.request.formData()).get('id')) || 0;
			try {
				const r = await confirmInvoice(event.locals.db, u.id, id, notifier(event));
				return { familyConfirmed: tutoraReceiptNumber(r.inv.receiptNo!) };
			} catch (e) {
				if (e instanceof FamilyBillingFail) return fail(400, { familyError: e.code });
				throw e;
			}
		},
		familyReject: async (event: RequestEvent) => {
			requireOwner(event.locals.user, event.url);
			const fd = await event.request.formData();
			try {
				await rejectInvoice(
					event.locals.db,
					Number(fd.get('id')) || 0,
					String(fd.get('reason') ?? ''),
					notifier(event)
				);
				return { familyRejected: true };
			} catch (e) {
				if (e instanceof FamilyBillingFail) return fail(400, { familyError: e.code });
				throw e;
			}
		}
	};
}
