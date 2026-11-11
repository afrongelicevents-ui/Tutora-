import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { TUTOR_EMAIL } from '$app/env/private';
import { signUp } from '#lib/server/actions/signup.ts';
import { hitLimit, clientIp } from '#lib/server/rate-limit.ts';
import { formObject } from '#lib/validation/auth.ts';
import { homeFor } from '#lib/roles.ts';
import { emailEnabled } from '#lib/server/auth.ts';
import { endLogin } from '#lib/server/auth-cookies.ts';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) redirect(303, homeFor(locals.user.role));
};

export const actions: Actions = {
	default: async ({ request, locals, cookies }) => {
		const input = formObject(await request.formData());
		const values = { ...input, password: '' };

		const limit = await hitLimit(locals.db, 'signup', clientIp(request));
		if (!limit.ok) {
			return fail(429, {
				values,
				errors: { form: 'err_rate_limited' },
				retryMinutes: Math.ceil(limit.retryAfterSeconds / 60)
			});
		}

		const result = await signUp(
			{ auth: locals.auth, db: locals.db, tutorEmail: TUTOR_EMAIL },
			input
		);
		if (!result.ok) return fail(400, { values, errors: result.errors });

		// Without an email service there is nothing to confirm: the new account is already logged in.
		if (!emailEnabled) {
			// A parent account was set up as "student" a moment ago; log in again so the
			// login cookie carries the right role.
			if (result.userId && result.role === 'parent') {
				await endLogin(locals.db, cookies, result.userId);
				await locals.auth.api
					.signInEmail({ body: { email: result.email, password: input.password ?? '' } })
					.catch(() => {});
			}
			redirect(303, '/student');
		}
		redirect(303, `/verify-email?email=${encodeURIComponent(result.email)}`);
	}
};
