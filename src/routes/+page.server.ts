import type { PageServerLoad } from './$types';
import { publicSite } from '#lib/server/settings.ts';

export const load: PageServerLoad = async ({ locals }) => {
	return { site: await publicSite(locals.db) };
};
