import type { PageServerLoad } from './$types';
import { requireOwner } from '#lib/server/guards.ts';
import { LIMITS } from '#lib/server/free-limits.ts';
import { latestUsage } from '#lib/server/owner-admin.ts';
import { TEST_SITE } from '$app/env/private';
import { AI_FREE_PER_DAY, AI_TUTOR_CAP, aiStopLine, aiToday } from '#lib/server/ai-tests.ts';

/** System → Free limits: the latest hourly reading for the live and the test site. */
export const load: PageServerLoad = async ({ locals, url }) => {
	requireOwner(locals.user, url);
	const [live, test, ai] = await Promise.all([
		latestUsage(locals.db, 'live'),
		latestUsage(locals.db, 'test'),
		aiToday(locals.db, null)
	]);
	const stopAt = aiStopLine(TEST_SITE === '1');
	return {
		live,
		test,
		limits: LIMITS,
		// the AI test maker on this site right now (our own counter, resets 00:00 UTC)
		ai: {
			used: ai.neurons,
			calls: ai.calls,
			stopAt,
			free: AI_FREE_PER_DAY,
			tutorCap: AI_TUTOR_CAP,
			share: stopAt ? ai.neurons / stopAt : 0
		}
	};
};
