import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { signUpTutor } from '#lib/server/actions/setup.ts';
import { hitLimit, clientIp } from '#lib/server/rate-limit.ts';
import { formObject } from '#lib/validation/auth.ts';
import { homeFor } from '#lib/roles.ts';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user)
		redirect(303, locals.user.role === 'tutor' ? '/tutor-status' : homeFor(locals.user.role));
};

/** A tutor creates their account. It waits for the platform owner's approval. */
export const actions: Actions = {
	default: async ({ request, locals }) => {
		const f = formObject(await request.formData());
		const values = { name: f.name ?? '', email: f.email ?? '' };
		const limit = await hitLimit(locals.db, 'signup', clientIp(request));
		if (!limit.ok)
			return fail(429, {
				values,
				errors: { form: 'err_rate_limited' } as Record<string, string>,
				retryMinutes: Math.ceil(limit.retryAfterSeconds / 60)
			});
		const r = await signUpTutor(
			{ auth: locals.auth, db: locals.db },
			{
				name: f.name ?? '',
				email: f.email ?? '',
				password: f.password ?? '',
				confirm: f.confirm ?? '',
				terms: f.terms
			}
		);
		if (!r.ok) return fail(400, { values, errors: r.errors });
		// log the new tutor in, then show "waiting for approval" (with an email service on,
		// they first confirm their email address)
		const email = values.email.trim().toLowerCase();
		const loggedIn = await locals.auth.api
			.signInEmail({ body: { email, password: f.password ?? '', rememberMe: true } })
			.then(() => true)
			.catch(() => false);
		if (!loggedIn) redirect(303, `/verify-email?email=${encodeURIComponent(email)}`);
		// next: the authenticator app, then the profile wizard
		redirect(303, '/account?welcome=1');
	}
};
