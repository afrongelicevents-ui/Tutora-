import type { PageServerLoad } from './$types';
import { requireOwner } from '#lib/server/guards.ts';
import { blockList, overviewCounts, suspendedList } from '#lib/server/owner-admin.ts';

/**
 * Safety: reports, photo and bio checks, study buddy reports, blocks and suspended accounts
 * in one place. Each card opens the page where it is handled.
 */
export const load: PageServerLoad = async ({ locals, url }) => {
	requireOwner(locals.user, url);
	const [counts, blocks, suspended] = await Promise.all([
		overviewCounts(locals.db),
		blockList(locals.db),
		suspendedList(locals.db)
	]);
	return { counts, blocks, suspended };
};
