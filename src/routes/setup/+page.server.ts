import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { dev } from '$app/env';
import { claimOwner, ownerExists } from '#lib/server/actions/setup.ts';
import { clientIp, hitLimit } from '#lib/server/rate-limit.ts';
import { formObject } from '#lib/validation/auth.ts';
import { createSetupCode, hasSetupCode } from '#lib/server/setup-code.ts';

/**
 * Set-up of the platform owner's account with the one-time code from the deploy
 * (the link is /setup?code=XXXX-XXXX-XXXX). It is never a landing page: without a code
 * it goes to the homepage, and it closes for good once the owner exists.
 */
export const load: PageServerLoad = async ({ locals, url }) => {
	const code = url.searchParams.get('code')?.slice(0, 40) ?? '';
	if (!code) redirect(303, '/');
	const done = await ownerExists(locals.db);
	if (dev && !done && !(await hasSetupCode(locals.db))) {
		// local development only: there is no deploy to make a code, so print one
		console.log(`[dev] Owner setup code: ${await createSetupCode(locals.db)}`);
	}
	return { done, code };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const limit = await hitLimit(locals.db, 'tutorSetup', clientIp(request));
		if (!limit.ok)
			return fail(429, {
				errors: { form: 'err_rate_limited' } as Record<string, string>,
				retryMinutes: Math.ceil(limit.retryAfterSeconds / 60)
			});
		const f = formObject(await request.formData());
		const r = await claimOwner(
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
		redirect(303, '/login?claimed=1');
	}
};
