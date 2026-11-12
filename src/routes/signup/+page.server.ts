import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { signUp } from '#lib/server/actions/signup.ts';
import { hitLimit, clientIp } from '#lib/server/rate-limit.ts';
import { formObject } from '#lib/validation/auth.ts';
import { looksLikeBot } from '#lib/server/bot.ts';
import { homeFor } from '#lib/roles.ts';
import { safeNext } from '#lib/server/guards.ts';
import { emailEnabled } from '#lib/server/auth.ts';
import { activeTutorBySlug } from '#lib/server/settings.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) redirect(303, homeFor(locals.user.role));
	// signing up from a tutor's page: show whose student they will be
	const tutor = await activeTutorBySlug(locals.db, url.searchParams.get('tutor') ?? '');
	return { tutorName: tutor?.tutorName ?? null };
};

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		const input = formObject(await request.formData());
		const values = { ...input, password: '' };

		if (looksLikeBot(input))
			return fail(400, { values, errors: { form: 'err_try_again' } as Record<string, string> });
		const limit = await hitLimit(locals.db, 'signup', clientIp(request));
		if (!limit.ok) {
			return fail(429, {
				values,
				errors: { form: 'err_rate_limited' },
				retryMinutes: Math.ceil(limit.retryAfterSeconds / 60)
			});
		}

		// the public sign-up only makes students; parents join with a child's code (/code)
		const result = await signUp(
			{ auth: locals.auth, db: locals.db },
			{ ...input, accountType: 'student' }
		);
		if (!result.ok) return fail(400, { values, errors: result.errors });

		// Without an email service there is nothing to confirm: the new account is already logged in.
		if (!emailEnabled) {
			// straight on to booking when they came from a tutor's page
			redirect(303, safeNext(url.searchParams.get('next'), '/student'));
		}
		redirect(303, `/verify-email?email=${encodeURIComponent(result.email)}`);
	}
};
