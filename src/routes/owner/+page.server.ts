import type { PageServerLoad } from './$types';
import { TEST_SITE } from '$app/env/private';
import { requireOwner } from '#lib/server/guards.ts';
import { latestUsage, overviewCounts } from '#lib/server/owner-admin.ts';
import { doneFrom } from './done.ts';
import { ownerFamilyStats } from '#lib/server/family-billing.ts';

/**
 * Overview: what needs the owner now (each with a count and a button), the key numbers and
 * the free limits. Approving tutors, adding tutors and resetting passwords live on the
 * People pages; resetting test data under Settings.
 */
export const load: PageServerLoad = async ({ locals, url }) => {
	requireOwner(locals.user, url);
	const [counts, family, live, test] = await Promise.all([
		overviewCounts(locals.db),
		ownerFamilyStats(locals.db),
		latestUsage(locals.db, 'live'),
		latestUsage(locals.db, 'test')
	]);
	const testSite = TEST_SITE === '1';
	// the site the owner is on is the one that matters most; the other is shown too
	const here = testSite ? test : live;
	return {
		counts,
		family,
		usage: here ? { at: here.at, meters: here.meters } : null,
		testSite,
		done: doneFrom(url)
	};
};
