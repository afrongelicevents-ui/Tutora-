import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { TUTOR_EMAIL } from '$app/env/private';
import { requestTutorSetup, tutorIsSetUp } from '#lib/server/actions/setup.ts';
import { clientIp, hitLimit } from '#lib/server/rate-limit.ts';

export const load: PageServerLoad = async ({ locals }) => ({ done: await tutorIsSetUp(locals.db) });

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const limit = await hitLimit(locals.db, 'tutorSetup', clientIp(request));
		if (!limit.ok)
			return fail(429, {
				errors: { form: 'err_rate_limited' },
				retryMinutes: Math.ceil(limit.retryAfterSeconds / 60)
			});
		const email = String((await request.formData()).get('email') ?? '');
		const r = await requestTutorSetup(
			{ auth: locals.auth, db: locals.db, tutorEmail: TUTOR_EMAIL },
			email
		);
		if (!r.ok) return fail(400, { errors: { email: 'err_email' } });
		return { sent: true };
	}
};
