import { shortName } from '#lib/names.ts';
import type { PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { streak, weekSummary } from '#lib/server/study.ts';
import {
	homeworkDueCount,
	learningJourney,
	mySubjects,
	nextLessonFor
} from '#lib/server/student-home.ts';
import { subjectOptions } from '#lib/server/settings.ts';
import { attentionFor } from '#lib/server/student.ts';
import { local } from '#lib/tz.ts';

/**
 * Student Home answers three questions only: where am I, what can I continue, what next.
 * Everything else (check-ins, plans, tools, knowledge checks) lives on its own page.
 * Every value comes from the student's own records; nothing is made up.
 */
export const load: PageServerLoad = async ({ locals, url }) => {
	const u = requireRole(locals.user, url, ['student']);
	const now = new Date();
	const [journey, mine, platform, next, attention, due, days, week] = await Promise.all([
		learningJourney(locals.db, u.id, now),
		mySubjects(locals.db, u.id),
		subjectOptions(locals.db),
		nextLessonFor(locals.db, u.id, now),
		attentionFor(locals.db, u.id, now),
		homeworkDueCount(locals.db, u.id, now),
		streak(locals.db, u.id, now),
		weekSummary(locals.db, u.id, now)
	]);
	const hour = local(now).minutes / 60;
	// three tiles: the student's own subjects first, then subjects taught on Tutora to explore
	const seen = new Set(mine.map((s) => s.toLowerCase()));
	const tiles = [...mine, ...platform.filter((s) => !seen.has(s.toLowerCase()))].slice(0, 3);
	const urgent = attention.find(
		(a) => a.kind === 'owe' || a.kind === 'proposal' || a.kind === 'payment_declined'
	);
	return {
		now,
		firstName: shortName(u.name),
		partOfDay: hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening',
		journey,
		tiles: tiles.map((name) => ({ name, mine: seen.has(name.toLowerCase()) })),
		next,
		urgent: urgent ?? null,
		due,
		streak: days,
		week: { done: week.done, planned: week.planned }
	};
};
