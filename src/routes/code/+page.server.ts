import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { previewInvite } from '#lib/server/family.ts';
import { rememberCode } from '#lib/server/family-code.ts';
import { clientIp, hitLimit } from '#lib/server/rate-limit.ts';

export const actions: Actions = {
	default: async ({ request, locals, cookies }) => {
		const code = String((await request.formData()).get('code') ?? '').slice(0, 40);
		const limit = await hitLimit(locals.db, 'familyCode', clientIp(request));
		if (!limit.ok)
			return fail(429, {
				code,
				error: 'err_rate_limited',
				retryMinutes: Math.ceil(limit.retryAfterSeconds / 60)
			});
		const preview = await previewInvite(locals.db, code);
		if (!preview) return fail(400, { code, error: 'v3_code_bad' });
		rememberCode(cookies, code);
		redirect(303, '/code/connect');
	}
};
