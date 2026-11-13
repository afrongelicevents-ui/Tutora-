import type { PageServerLoad } from './$types';
import { requireTutor } from '#lib/server/guards.ts';
import { getSettings, listSubjects } from '#lib/server/settings.ts';
import { teachingCentre } from '#lib/server/teaching-centre.ts';
import { today } from '#lib/server/planner.ts';
import { lessonsBetween } from '#lib/server/bookings.ts';
import { answersToCheck } from '#lib/server/people.ts';
import { addDays, startOfLocalDay } from '#lib/tz.ts';

/** More: the tutor's teaching centre (profile, day, impact, achievements, tools, settings). */
export const load: PageServerLoad = async ({ locals, url }) => {
	const t = requireTutor(locals.user, url).id;
	const now = new Date();
	const day = startOfLocalDay(now);
	const [s, subjects, centre, mine, lessons, toCheck] = await Promise.all([
		getSettings(locals.db, t),
		listSubjects(locals.db, t),
		teachingCentre(locals.db, t, now),
		today(locals.db, t, now),
		lessonsBetween(locals.db, t, day, addDays(day, 1)),
		answersToCheck(locals.db, t)
	]);
	return {
		profile: {
			name: s.tutorName || locals.user!.name,
			slug: s.slug,
			verified: s.status === 'active',
			photo: s.photoKey ? `/tutor/photo?v=${s.photoVersion}` : null,
			subjects: subjects.filter((x) => x.active).map((x) => x.name)
		},
		centre,
		day: {
			date: now.toISOString(),
			lessons: lessons.map((l) => ({
				id: l.id,
				startsAt: l.startsAt,
				subjectName: l.subjectName,
				who: l.people.map((p) => p.name.split(' ')[0])
			})),
			tasks: mine.items.filter((i) => i.kind === 'task'),
			toCheck: toCheck.length
		}
	};
};
