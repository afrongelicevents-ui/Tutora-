import type { Actions, PageServerLoad } from './$types';
import { requireOwner } from '#lib/server/guards.ts';
import { pageFrom, paymentList, searchFrom } from '#lib/server/owner-admin.ts';
import { ownerFamilyActions, ownerFamilyLoad } from '#lib/server/family-owner.ts';
import { ownerFamilyStats } from '#lib/server/family-billing.ts';
import { ownerProActions, ownerProLoad } from '#lib/server/pro-owner.ts';
import { ownerProStats } from '#lib/server/pro.ts';

/**
 * Money → Payments, three tabs: tutor payments (records students and tutors keep, read only,
 * with receipts), Tutora Family (invoices families pay to Tutora) and Tutora Pro (invoices
 * tutors pay to Tutora): check the proof, then confirm or reject with a reason.
 */
export const load: PageServerLoad = async (event) => {
	const { locals, url } = event;
	requireOwner(locals.user, url);
	// the Family tab: asked for, one of its filters, or just after one of its actions
	const family =
		url.searchParams.get('view') === 'family' ||
		url.searchParams.has('fstatus') ||
		[...url.searchParams.keys()].some((k) => k.startsWith('/family'));
	const pro =
		url.searchParams.get('view') === 'pro' ||
		url.searchParams.has('pstatus') ||
		[...url.searchParams.keys()].some((k) => k.startsWith('/pro'));
	if (pro) {
		const [p, f] = await Promise.all([ownerProLoad(event), ownerFamilyStats(locals.db)]);
		return {
			view: 'pro' as const,
			...p,
			proofsWaiting: f.proofsWaiting,
			proProofsWaiting: p.pro.stats.proofsWaiting
		};
	}
	if (family) {
		const [f, p] = await Promise.all([ownerFamilyLoad(event), ownerProStats(locals.db)]);
		return {
			view: 'family' as const,
			...f,
			proofsWaiting: f.family.stats.proofsWaiting,
			proProofsWaiting: p.proofsWaiting
		};
	}
	const status = url.searchParams.get('status') ?? '';
	const q = searchFrom(url);
	const { page, limit, offset } = pageFrom(url);
	const [r, f, p] = await Promise.all([
		paymentList(locals.db, { status, q, limit, offset }),
		ownerFamilyStats(locals.db),
		ownerProStats(locals.db)
	]);
	return {
		view: 'tutor' as const,
		status,
		q,
		page,
		payments: r.rows,
		counts: r.counts,
		total: r.total,
		proofsWaiting: f.proofsWaiting,
		proProofsWaiting: p.proofsWaiting
	};
};

const fam = ownerFamilyActions();
const pro = ownerProActions();
export const actions: Actions = {
	familyConfirm: fam.familyConfirm,
	familyReject: fam.familyReject,
	proConfirm: pro.proConfirm,
	proReject: pro.proReject
};
