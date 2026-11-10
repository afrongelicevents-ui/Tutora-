import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '#lib/server/auth.ts';
import { fieldErrors, formObject, resetSchema } from '#lib/validation/auth.ts';

export const load: PageServerLoad = ({ url }) => {
	const token = url.searchParams.get('token');
	const invalid = !token || url.searchParams.get('error') === 'INVALID_TOKEN';
	return { token: invalid ? null : token };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const parsed = resetSchema.safeParse(formObject(await request.formData()));
		if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error) });
		try {
			await auth.api.resetPassword({
				body: { newPassword: parsed.data.password, token: parsed.data.token }
			});
		} catch (e) {
			if (e instanceof APIError) return fail(400, { errors: { form: 'reset_invalid' } });
			throw e;
		}
		redirect(303, '/login?reset=1');
	}
};
