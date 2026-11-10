import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { TUTOR_EMAIL } from '$app/env/private';
import { auth } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import { requestTutorSetup, tutorIsSetUp } from '#lib/server/actions/setup.ts';
import { clientIp, hitLimit } from '#lib/server/rate-limit.ts';

export const load: PageServerLoad = async () => ({ done: await tutorIsSetUp(db) });

export const actions: Actions = {
	default: async ({ request }) => {
		const limit = await hitLimit(db, 'tutorSetup', clientIp(request));
		if (!limit.ok)
			return fail(429, {
				errors: { form: 'err_rate_limited' },
				retryMinutes: Math.ceil(limit.retryAfterSeconds / 60)
			});
		const email = String((await request.formData()).get('email') ?? '');
		const r = await requestTutorSetup({ auth, db, tutorEmail: TUTOR_EMAIL }, email);
		if (!r.ok) return fail(400, { errors: { email: 'err_email' } });
		return { sent: true };
	}
};
