import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { activeTutorBySlug, publicSite, tutorBySlug } from '#lib/server/settings.ts';

/**
 * A tutor's public page. Only approved tutors have one; pending or suspended tutors and
 * unknown addresses are "not found". Payment details are never part of this.
 */
export const load: LayoutServerLoad = async ({ locals, params }) => {
	// the owner may preview a profile that is not approved yet (to approve it)
	const s =
		(await activeTutorBySlug(locals.db, params.slug)) ??
		(locals.user?.role === 'owner' ? await tutorBySlug(locals.db, params.slug) : null);
	if (!s) error(404, 'Not found');
	const site = await publicSite(locals.db, s);
	// tutorId is not needed on the page: drop it from what the browser receives
	const { tutorId: _id, ...pub } = site;
	return { site: pub, tutorWhatsapp: site.whatsapp, preview: s.status !== 'active' };
};
