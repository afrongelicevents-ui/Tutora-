import type { PageServerLoad } from './$types';
import { activeTutorBySlug } from '#lib/server/settings.ts';
import { familyOf } from '#lib/server/family.ts';
import { requireRole } from '#lib/server/guards.ts';
import { myTutor } from '#lib/server/people.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	const u = requireRole(locals.user, url, ['student']);
	const slug = url.searchParams.get('tutor') ?? '';
	const [t, fam, mine] = await Promise.all([
		activeTutorBySlug(locals.db, slug),
		familyOf(locals.db, u.id),
		// already this tutor's student: paying is open now (new students pay once accepted)
		slug ? myTutor(locals.db, u.id, slug) : null
	]);
	return {
		tutorName: t?.tutorName ?? null,
		paySlug: t && mine ? slug : null,
		family: fam.some((f) => f.status === 'active' && f.shareLessons)
	};
};
