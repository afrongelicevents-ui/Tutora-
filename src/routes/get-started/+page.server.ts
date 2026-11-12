import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { homeFor } from '#lib/roles.ts';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) redirect(303, homeFor(locals.user.role));
};
