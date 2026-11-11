import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { emailEnabled } from '#lib/server/auth.ts';

export const load: PageServerLoad = () => ({ emailOn: emailEnabled });
import { hitLimit, clientIp } from '#lib/server/rate-limit.ts';
import { fieldErrors, forgotSchema, formObject } from '#lib/validation/auth.ts';

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!emailEnabled) return { askTutor: true };
		const input = formObject(await request.formData());
		const parsed = forgotSchema.safeParse(input);
		if (!parsed.success) return fail(400, { values: input, errors: fieldErrors(parsed.error) });
		const limit = await hitLimit(locals.db, 'passwordReset', clientIp(request));
		if (!limit.ok)
			return fail(429, {
				values: input,
				errors: { form: 'err_rate_limited' },
				retryMinutes: Math.ceil(limit.retryAfterSeconds / 60)
			});
		// Same answer whether or not the account exists, so emails can't be discovered.
		await locals.auth.api
			.requestPasswordReset({ body: { email: parsed.data.email, redirectTo: '/reset-password' } })
			.catch(() => {});
		return { sent: true };
	}
};
