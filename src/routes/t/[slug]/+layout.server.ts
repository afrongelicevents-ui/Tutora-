import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { activeTutorBySlug, publicSite } from '#lib/server/settings.ts';

/**
 * A tutor's public page. Only approved tutors have one; pending or suspended tutors and
 * unknown addresses are "not found". Payment details are never part of this.
 */
export const load: LayoutServerLoad = async ({ locals, params }) => {
	const s = await activeTutorBySlug(locals.db, params.slug);
	if (!s) error(404, 'Not found');
	const site = await publicSite(locals.db, s);
	// tutorId is not needed on the page: drop it from what the browser receives
	const { tutorId: _id, ...pub } = site;
	return { site: pub, tutorWhatsapp: site.whatsapp };
};
