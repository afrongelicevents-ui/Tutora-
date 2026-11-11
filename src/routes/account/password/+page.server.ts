import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { requireUser } from '#lib/server/guards.ts';
import { clearMustChange } from '#lib/server/account.ts';
import { hitLimit, clientIp } from '#lib/server/rate-limit.ts';
import { fieldErrors, formObject } from '#lib/validation/auth.ts';
import { homeFor } from '#lib/roles.ts';

/** Anyone can change their own password here (and must, after a temporary one). */
export const load: PageServerLoad = ({ locals, url }) => {
	requireUser(locals.user, url);
	return { forced: url.searchParams.has('forced') };
};

const schema = z.object({
	currentPassword: z.string().min(1, 'err_password_wrong').max(128),
	newPassword: z.string().min(10, 'err_password_short').max(128, 'err_too_long')
});

export const actions: Actions = {
	default: async ({ locals, url, request }) => {
		const u = requireUser(locals.user, url);
		const limit = await hitLimit(locals.db, 'passwordReset', `${clientIp(request)}:${u.id}:pw`);
		if (!limit.ok) return fail(429, { errors: { currentPassword: 'err_rate_limited' } });
		const parsed = schema.safeParse(formObject(await request.formData()));
		if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error) });
		if (parsed.data.newPassword === parsed.data.currentPassword)
			return fail(400, { errors: { newPassword: 'err_password_same' } });
		try {
			await locals.auth.api.changePassword({
				body: { ...parsed.data, revokeOtherSessions: true },
				headers: request.headers
			});
		} catch (e) {
			if (e instanceof APIError)
				return fail(400, { errors: { currentPassword: 'err_password_wrong' } });
			throw e;
		}
		await clearMustChange(locals.db, u.id);
		redirect(303, homeFor(u.role));
	}
};
