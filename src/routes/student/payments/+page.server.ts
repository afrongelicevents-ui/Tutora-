import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { paymentsActions, paymentsLoad } from '#lib/server/payments-page.ts';

export const load: PageServerLoad = async (e) => {
	const u = requireRole(e.locals.user, e.url, ['student']);
	return paymentsLoad(e, { id: u.id, name: u.name }, '/student/find');
};

export const actions: Actions = paymentsActions(async (e) => {
	const u = requireRole(e.locals.user, e.url, ['student']);
	return { id: u.id, name: u.name };
});
