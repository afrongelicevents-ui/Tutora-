import type { PageServerLoad } from './$types';
import { requireOwner } from '#lib/server/guards.ts';
import { LIMITS } from '#lib/server/free-limits.ts';
import { latestUsage } from '#lib/server/owner-admin.ts';

/** System → Free limits: the latest hourly reading for the live and the test site. */
export const load: PageServerLoad = async ({ locals, url }) => {
	requireOwner(locals.user, url);
	const [live, test] = await Promise.all([
		latestUsage(locals.db, 'live'),
		latestUsage(locals.db, 'test')
	]);
	return { live, test, limits: LIMITS };
};
