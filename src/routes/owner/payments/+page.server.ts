import type { PageServerLoad } from './$types';
import { requireOwner } from '#lib/server/guards.ts';
import { allPayments } from '#lib/server/owner.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	requireOwner(locals.user, url);
	const status = url.searchParams.get('status') ?? '';
	return {
		status,
		// "reported but not confirmed after 7 days" first, so disagreements are easy to spot
		stale: await allPayments(locals.db, undefined, true),
		payments: await allPayments(locals.db, status)
	};
};
