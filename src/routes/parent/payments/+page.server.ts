import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { paymentsActions, paymentsLoad } from '#lib/server/payments-page.ts';
import { parentPayer } from '#lib/server/parent-payer.ts';

export const load: PageServerLoad = async (e) => {
	const u = requireRole(e.locals.user, e.url, ['parent']);
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
