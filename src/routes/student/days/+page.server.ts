import type { PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { daySummaries } from '#lib/server/checkins.ts';
import { isIsoDate, localDate } from '#lib/tz.ts';

/** "My days": one summary per day, newest first; older days page by page. */
export const load: PageServerLoad = async ({ locals, url }) => {
	const u = requireRole(locals.user, url, ['student']);
	const before = url.searchParams.get('before');
	const r = await daySummaries(locals.db, u.id, {
		before: before && isIsoDate(before) ? before : undefined,
		days: 14
	});
	return { ...r, today: localDate(new Date()) };
};
