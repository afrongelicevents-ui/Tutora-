import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Updates now live behind the bell (Notifications): old links still work. */
export const load: PageServerLoad = ({ url }) => {
	redirect(308, `/parent/notifications${url.search}`);
};
