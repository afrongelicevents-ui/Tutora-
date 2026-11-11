import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { TUTOR_EMAIL } from '$app/env/private';
import {
	claimTutor,
	requestTutorSetup,
	tutorExists,
	tutorIsSetUp
} from '#lib/server/actions/setup.ts';
import { clientIp, hitLimit } from '#lib/server/rate-limit.ts';
import { formObject } from '#lib/validation/auth.ts';
import { endLogin } from '#lib/server/auth-cookies.ts';
import { createSetupCode, hasSetupCode } from '#lib/server/setup-code.ts';
import { dev } from '$app/env';

/**
 * Two ways to claim the tutor account:
 * - TUTOR_EMAIL set: type that email, get a link, choose a password (proves the inbox).
 * - TUTOR_EMAIL not set (simplest): whoever has the one-time setup code from the deploy
 *   creates the account directly. The link may carry it: /setup?code=XXXX-XXXX-XXXX.
 */
export const load: PageServerLoad = async ({ locals, url }) => {
	const done = TUTOR_EMAIL ? await tutorIsSetUp(locals.db) : await tutorExists(locals.db);
	if (dev && !TUTOR_EMAIL && !done && !(await hasSetupCode(locals.db))) {
		// local development only: there is no deploy to make a code, so print one
		console.log(`[dev] Tutor setup code: ${await createSetupCode(locals.db)}`);
	}
	return {
		done,
		mode: TUTOR_EMAIL ? ('email' as const) : ('direct' as const),
		code: url.searchParams.get('code')?.slice(0, 40) ?? ''
	};
};

export const actions: Actions = {
	default: async ({ request, locals, cookies }) => {
		const limit = await hitLimit(locals.db, 'tutorSetup', clientIp(request));
		if (!limit.ok)
			return fail(429, {
				errors: { form: 'err_rate_limited' } as Record<string, string>,
				retryMinutes: Math.ceil(limit.retryAfterSeconds / 60)
			});
		const f = formObject(await request.formData());
		if (TUTOR_EMAIL) {
			const r = await requestTutorSetup(
				{ auth: locals.auth, db: locals.db, tutorEmail: TUTOR_EMAIL },
				f.email ?? ''
			);
			if (!r.ok) return fail(400, { errors: { email: 'err_email' } as Record<string, string> });
			return { sent: true };
		}
		const r = await claimTutor(
			{ auth: locals.auth, db: locals.db },
			{
				name: f.name ?? '',
				email: f.email ?? '',
				password: f.password ?? '',
				confirm: f.confirm ?? '',
				code: f.code ?? ''
			}
		);
		if (!r.ok)
			return fail(400, {
				errors: r.errors,
				values: { name: f.name ?? '', email: f.email ?? '', code: f.code ?? '' }
			});
		// Sign-up logged them in as a student a moment ago; start clean so the login carries the tutor role.
		await endLogin(locals.db, cookies, r.userId);
		redirect(303, '/login?claimed=1');
	}
};
