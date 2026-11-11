import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { logIn } from '#lib/server/actions/login.ts';
import { hitLimit, clientIp } from '#lib/server/rate-limit.ts';
import { safeNext } from '#lib/server/guards.ts';
import { emailField, formObject } from '#lib/validation/auth.ts';
import { homeFor } from '#lib/roles.ts';
import { eq } from 'drizzle-orm';
import { user } from '#lib/server/db/auth.schema.ts';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeNext(url.searchParams.get('next'), homeFor(locals.user.role)));
};

export const actions: Actions = {
	default: async ({ request, url, locals }) => {
		const input = formObject(await request.formData());
		const values = { email: input.email ?? '' };
		// Key the limits on the cleaned-up email, so "a@b.com " and "A@B.com" share one bucket.
		const email = emailField.safeParse(input.email ?? '');
		const who = email.success ? email.data : 'invalid';
		const ip = clientIp(request);
		const byIp = await hitLimit(locals.db, 'login', `${ip}:${who}`);
		const byAccount = await hitLimit(locals.db, 'loginAccount', who);
		const byIpOnly = await hitLimit(locals.db, 'loginIp', ip);
		const limit = !byIp.ok ? byIp : !byIpOnly.ok ? byIpOnly : byAccount;
		if (!limit.ok) {
			return fail(429, {
				values,
				errors: { form: 'err_rate_limited' },
				retryMinutes: Math.ceil(limit.retryAfterSeconds / 60)
			});
		}

		// accounts suspended by the Tutora team cannot log in
		if (email.success) {
			const [acc] = await locals.db
				.select({ s: user.suspendedAt })
				.from(user)
				.where(eq(user.email, email.data));
			if (acc?.s) return fail(403, { values, errors: { form: 'err_suspended' } });
		}
		const result = await logIn({ auth: locals.auth }, input, request.headers);
		if (!result.ok) return fail(400, { values, errors: result.errors });

		const next = url.searchParams.get('next');
		if (result.twoFactor) {
			redirect(303, `/login/2fa${next ? `?next=${encodeURIComponent(next)}` : ''}`);
		}
		// role is not known in this request yet; /account forwards to the right place
		redirect(303, safeNext(next, '/account?welcome=1'));
	}
};
