import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { TUTOR_EMAIL } from '$app/env/private';
import { auth } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import { signUp } from '#lib/server/actions/signup.ts';
import { hitLimit, clientIp } from '#lib/server/rate-limit.ts';
import { formObject } from '#lib/validation/auth.ts';
import { homeFor } from '#lib/roles.ts';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) redirect(303, homeFor(locals.user.role));
};

export const actions: Actions = {
	default: async ({ request }) => {
		const input = formObject(await request.formData());
		const values = { ...input, password: '' };

		const limit = await hitLimit(db, 'signup', clientIp(request));
		if (!limit.ok) {
			return fail(429, {
				values,
				errors: { form: 'err_rate_limited' },
				retryMinutes: Math.ceil(limit.retryAfterSeconds / 60)
			});
		}

		const result = await signUp({ auth, db, tutorEmail: TUTOR_EMAIL }, input);
		if (!result.ok) return fail(400, { values, errors: result.errors });

		redirect(303, `/verify-email?email=${encodeURIComponent(result.email)}`);
	}
};
