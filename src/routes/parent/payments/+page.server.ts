import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { paymentsActions, paymentsLoad } from '#lib/server/payments-page.ts';
import { parentPayer } from '#lib/server/parent-payer.ts';
import { redirect } from '@sveltejs/kit';
import { childrenOf } from '#lib/server/family.ts';

export const load: PageServerLoad = async (e) => {
	const u = requireRole(e.locals.user, e.url, ['parent']);
	// the menu link has no child: open the payments of a child this parent pays for
	// (the last one chosen first); only a parent with no such child sees their own account
	if (!e.url.searchParams.has('child')) {
		const kids = (await childrenOf(e.locals.db, u.id)).filter(
			(c) => c.status === 'active' && c.guardian
		);
		const last = e.cookies.get('tutora_child');
		const pick = kids.find((c) => c.studentId === last) ?? kids[0];
		if (pick) {
			const to = new URL(e.url);
			to.searchParams.set('child', pick.studentId);
			redirect(303, to.pathname + to.search);
		}
	}
	const payer = await parentPayer(e.locals.db, u, e.url);
	const child = e.url.searchParams.get('child');
	return {
		...(await paymentsLoad(e, payer, '/parent/children')),
		child,
		payerName: child ? payer.name : null
	};
};

export const actions: Actions = paymentsActions(async (e) => {
	const u = requireRole(e.locals.user, e.url, ['parent']);
	return parentPayer(e.locals.db, u, e.url);
});
