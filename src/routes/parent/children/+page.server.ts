import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** The family admin moved to Settings: old links and bookmarks still work. */
export const load: PageServerLoad = ({ url }) => {
	redirect(308, `/parent/settings${url.search}`);
};
