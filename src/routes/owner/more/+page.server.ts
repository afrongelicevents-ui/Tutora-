import type { PageServerLoad } from './$types';
import { requireOwner } from '#lib/server/guards.ts';
import { overviewCounts } from '#lib/server/owner-admin.ts';

/** More (phone tab): every section of Tutora admin, with what waits in each. */
export const load: PageServerLoad = async ({ locals, url }) => {
	requireOwner(locals.user, url);
	return { counts: await overviewCounts(locals.db) };
};
