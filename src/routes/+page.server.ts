import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getContent } from '#lib/server/content.ts';
import { homeFor } from '#lib/roles.ts';

/** Welcome: one photo, the tagline, Get started and Sign in. Signed-in people go to their home. */
export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) redirect(303, homeFor(locals.user.role));
	const content = await getContent(locals.db);
	return { heroPhotoV: content.heroPhoto ? content.heroPhotoV : null };
};
