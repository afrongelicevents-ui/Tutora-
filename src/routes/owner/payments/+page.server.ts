import type { Actions, PageServerLoad } from './$types';
import { requireOwner } from '#lib/server/guards.ts';
import { pageFrom, paymentList, searchFrom } from '#lib/server/owner-admin.ts';
import { ownerFamilyActions, ownerFamilyLoad } from '#lib/server/family-owner.ts';
import { ownerFamilyStats } from '#lib/server/family-billing.ts';

/**
 * Money → Payments, two tabs: tutor payments (records students and tutors keep, read only,
 * with receipts) and Tutora Family (invoices families pay to Tutora: check the proof, then
 * confirm or reject with a reason).
 */
export const load: PageServerLoad = async (event) => {
	const { locals, url } = event;
	requireOwner(locals.user, url);
	// the Family tab: asked for, one of its filters, or just after one of its actions
	const family =
		url.searchParams.get('view') === 'family' ||
		url.searchParams.has('fstatus') ||
		[...url.searchParams.keys()].some((k) => k.startsWith('/family'));
	if (family) {
		const f = await ownerFamilyLoad(event);
		return { view: 'family' as const, ...f, proofsWaiting: f.family.stats.proofsWaiting };
	}
	const status = url.searchParams.get('status') ?? '';
	const q = searchFrom(url);
	const { page, limit, offset } = pageFrom(url);
	const [r, f] = await Promise.all([
		paymentList(locals.db, { status, q, limit, offset }),
		ownerFamilyStats(locals.db)
	]);
	return {
		view: 'tutor' as const,
		status,
		q,
		page,
		payments: r.rows,
		counts: r.counts,
		total: r.total,
		proofsWaiting: f.proofsWaiting
	};
};

const fam = ownerFamilyActions();
export const actions: Actions = {
	familyConfirm: fam.familyConfirm,
	familyReject: fam.familyReject
};
