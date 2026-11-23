import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { homeFor } from '#lib/roles.ts';

/**
 * Where the installed app opens (manifest `start_url`): the person's own home page, or
 * the login page (which comes back here) when nobody is signed in.
 */
export const load: PageServerLoad = ({ locals }) => {
	redirect(303, locals.user ? homeFor(locals.user.role) : '/login?next=%2Fapp');
};
