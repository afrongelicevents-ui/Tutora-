import type { PageServerLoad } from './$types';
import { activeTutorBySlug } from '#lib/server/settings.ts';
import { familyOf } from '#lib/server/family.ts';
import { requireRole } from '#lib/server/guards.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	const u = requireRole(locals.user, url, ['student']);
	const t = await activeTutorBySlug(locals.db, url.searchParams.get('tutor') ?? '');
	const fam = await familyOf(locals.db, u.id);
	return {
		tutorName: t?.tutorName ?? null,
		family: fam.some((f) => f.status === 'active' && f.shareLessons)
	};
};
