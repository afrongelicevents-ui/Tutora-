import type { PageServerLoad } from './$types';
import { requireTutor } from '#lib/server/guards.ts';
import { getSettings } from '#lib/server/settings.ts';

/** Add a student: share your own page; they become your student when they book with you. */
export const load: PageServerLoad = async ({ locals, url }) => {
	const t = requireTutor(locals.user, url).id;
	const s = await getSettings(locals.db, t);
	return {
		active: s.status === 'active',
		link: `${url.origin}/t/${s.slug}`,
		name: s.tutorName ?? ''
	};
};
