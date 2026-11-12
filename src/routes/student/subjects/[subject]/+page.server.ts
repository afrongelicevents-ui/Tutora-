import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { mySubjects, subjectOverview } from '#lib/server/student-home.ts';
import { subjectOptions } from '#lib/server/settings.ts';
import { topicScores } from '#lib/server/progress.ts';

/** One subject's learning page: only this student's own records for it, plus next actions. */
export const load: PageServerLoad = async ({ locals, url, params }) => {
	const u = requireRole(locals.user, url, ['student']);
	const raw = params.subject.trim().slice(0, 60);
	if (!raw) error(404, 'Not found');
	const now = new Date();
	const [mine, platform, topics, overview] = await Promise.all([
		mySubjects(locals.db, u.id),
		subjectOptions(locals.db),
		topicScores(locals.db, u.id, { subject: raw }),
		subjectOverview(locals.db, u.id, raw, now)
	]);
	// show the subject's usual spelling when we know it
	const known = [...mine, ...platform].find((s) => s.toLowerCase() === raw.toLowerCase());
	return {
		now,
		subject: known ?? raw,
		topics: topics.slice(0, 8),
		results: overview.results.map((r) => ({
			id: r.id,
			title: r.title,
			topic: r.topic,
			score: r.score,
			maxScore: r.maxScore,
			takenOn: r.takenOn
		})),
		homework: overview.homework,
		nextLesson: overview.nextLesson,
		lessonsDone: overview.lessonsDone,
		lastStudied: overview.lastStudied
	};
};
