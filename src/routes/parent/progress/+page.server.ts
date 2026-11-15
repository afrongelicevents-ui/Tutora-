import type { PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { parentAccess } from '#lib/server/family.ts';
import { pickChild } from '#lib/server/parent-child.ts';
import { overallProgress, recentResults, topicScores, pct } from '#lib/server/progress.ts';
import { sharedCheckins } from '#lib/server/checkins.ts';
import { shareReport, weekStats } from '#lib/server/planner.ts';
import { childPhotos } from '#lib/server/parent-home.ts';
import { addDays } from '#lib/tz.ts';

/** One child's progress: marks (academic) and, when the child shares it, their own week. */
export const load: PageServerLoad = async ({ locals, url, cookies }) => {
	const u = requireRole(locals.user, url, ['parent']);
	const { kids, current } = await pickChild(locals.db, u.id, url, cookies);
	if (!current) return { kids, current: null, child: null };
	const access = await parentAccess(locals.db, u.id, current);
	const now = new Date();
	const [overall, topics, results, shares, feelings, photos] = await Promise.all([
		access.progress ? overallProgress(locals.db, current, now) : Promise.resolve(null),
		access.progress ? topicScores(locals.db, current) : Promise.resolve([]),
		access.progress ? recentResults(locals.db, current, 12) : Promise.resolve([]),
		shareReport(locals.db, current),
		access.ok ? sharedCheckins(locals.db, current, addDays(now, -7), 14, now) : Promise.resolve([]),
		childPhotos(locals.db, [current])
	]);
	const week = shares ? await weekStats(locals.db, current, now) : null;
	const kid = kids.find((k) => k.id === current);
	return {
		kids,
		current,
		child: {
			id: current,
			name: kid?.name ?? '',
			level: kid?.level ?? null,
			photo: photos.get(current) ?? null,
			progressShared: access.progress,
			overall: overall?.current
				? {
						pct: overall.current.pct,
						change: overall.previous ? overall.current.pct - overall.previous.pct : null
					}
				: null,
			// best and weakest topics, a few of each, for the bar chart
			topics: topics.slice(0, 8).map((t) => ({ subject: t.subject, topic: t.topic, pct: t.pct })),
			// oldest → newest for the line
			trend: results
				.slice()
				.reverse()
				.map((r) => ({ on: r.takenOn, pct: pct(r.score, r.maxScore), title: r.title })),
			reportShared: shares,
			week: week
				? {
						days: week.days.map((d) => ({ date: d.date, pct: d.pct, future: 'future' in d })),
						daysPlanned: week.daysPlanned,
						daysFollowed: week.daysFollowed,
						tasksDone: week.tasksDone
					}
				: null,
			feelings: feelings.map((f) => ({ mood: f.mood, at: f.createdAt }))
		}
	};
};
