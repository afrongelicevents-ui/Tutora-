import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { site } = await parent();
	// sections the tutor hasn't filled in yet are hidden
	if (!site.has.reviews) redirect(303, `/t/${site.slug}`);
	return {};
};
