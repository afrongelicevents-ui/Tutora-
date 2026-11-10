import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import { logIn } from '#lib/server/actions/login.ts';
import { hitLimit, clientIp } from '#lib/server/rate-limit.ts';
import { safeNext } from '#lib/server/guards.ts';
import { emailField, formObject } from '#lib/validation/auth.ts';
import { homeFor } from '#lib/roles.ts';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeNext(url.searchParams.get('next'), homeFor(locals.user.role)));
};

export const actions: Actions = {
	default: async ({ request, url }) => {
		const input = formObject(await request.formData());
		const values = { email: input.email ?? '' };
		// Key the limits on the cleaned-up email, so "a@b.com " and "A@B.com" share one bucket.
		const email = emailField.safeParse(input.email ?? '');
		const who = email.success ? email.data : 'invalid';
		const ip = clientIp(request);
		const byIp = await hitLimit(db, 'login', `${ip}:${who}`);
		const byAccount = await hitLimit(db, 'loginAccount', who);
		const limit = !byIp.ok ? byIp : byAccount;
		if (!limit.ok) {
			return fail(429, {
				values,
				errors: { form: 'err_rate_limited' },
				retryMinutes: Math.ceil(limit.retryAfterSeconds / 60)
			});
		}

		const result = await logIn({ auth }, input, request.headers);
		if (!result.ok) return fail(400, { values, errors: result.errors });

		const next = url.searchParams.get('next');
		if (result.twoFactor) {
			redirect(303, `/login/2fa${next ? `?next=${encodeURIComponent(next)}` : ''}`);
		}
		// role is not known in this request yet; /account forwards to the right place
		redirect(303, safeNext(next, '/account?welcome=1'));
	}
};
