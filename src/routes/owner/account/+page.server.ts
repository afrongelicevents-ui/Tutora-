import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** The old address: the owner's login email and password are now under Settings. */
export const load: PageServerLoad = () => redirect(308, '/owner/settings');
