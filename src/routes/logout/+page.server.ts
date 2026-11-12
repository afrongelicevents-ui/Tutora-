import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { forgetCode } from '#lib/server/family-code.ts';

export const load: PageServerLoad = () => redirect(303, '/');

export const actions: Actions = {
	default: async ({ request, locals, cookies }) => {
		await locals.auth.api.signOut({ headers: request.headers });
		// a family code someone typed on this phone doesn't stay for the next person
		forgetCode(cookies);
		redirect(303, '/');
	}
};
