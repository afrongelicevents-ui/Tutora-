import type { PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { pickChild } from '#lib/server/parent-child.ts';
import { goals, shareReport, weekStats } from '#lib/server/planner.ts';
import { sharedCheckins } from '#lib/server/checkins.ts';
import { addDays } from '#lib/tz.ts';

/**
 * Family Connection: the child's personal report summary, ONLY if the child chose to share
 * it. Never notes, never private check-ins; school results are elsewhere.
 */
export const load: PageServerLoad = async ({ locals, url, cookies }) => {
	const u = requireRole(locals.user, url, ['parent']);
	const { kids, current } = await pickChild(locals.db, u.id, url, cookies);
	const kid = kids.find((k) => k.id === current);
	const name = kid?.name ?? '';
	if (!current || !(await shareReport(locals.db, current)))
		return { kids, current, name, shared: false as const };
	const now = new Date();
	const [w, g, checks] = await Promise.all([
		weekStats(locals.db, current, now),
		goals(locals.db, current, now),
		sharedCheckins(locals.db, current, addDays(now, -7), 10)
	]);
	return {
		kids,
		current,
		name,
		shared: true as const,
		week: { followed: w.daysFollowed, planned: w.daysPlanned, tasks: w.tasksDone },
		goalsReached: g.reachedThisWeek,
		checkins: checks.map((c) => ({ id: c.id, mood: c.mood, createdAt: c.createdAt }))
	};
};
