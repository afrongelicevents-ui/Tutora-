import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { publicSite } from '#lib/server/settings.ts';

export const load: PageServerLoad = async ({ locals }) => {
	const site = await publicSite(locals.db);
	// sections the tutor hasn't filled in yet are hidden
	if (!site.has.about) redirect(303, '/');
	return { site };
};
