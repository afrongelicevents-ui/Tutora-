import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import type { Actions } from './$types';
import { auth } from '#lib/server/auth.ts';
import { db } from '#lib/server/db/index.ts';
import { hitLimit, clientIp } from '#lib/server/rate-limit.ts';
import { safeNext } from '#lib/server/guards.ts';
import { backupCodeSchema, fieldErrors, formObject, totpCodeSchema } from '#lib/validation/auth.ts';

async function guard(request: Request) {
	const limit = await hitLimit(db, 'twoFactor', clientIp(request));
	return limit.ok ? null : fail(429, { errors: { form: 'err_rate_limited' }, retryMinutes: 1 });
}

function wrongCode(e: unknown) {
	if (e instanceof APIError) return fail(400, { errors: { code: 'err_code_wrong' } });
	throw e;
}

export const actions: Actions = {
	totp: async ({ request, url }) => {
		const limited = await guard(request);
		if (limited) return limited;
		const parsed = totpCodeSchema.safeParse(formObject(await request.formData()));
		if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error) });
		try {
			await auth.api.verifyTOTP({
				body: { code: parsed.data.code, trustDevice: parsed.data.trustDevice },
				headers: request.headers
			});
		} catch (e) {
			return wrongCode(e);
		}
		redirect(303, safeNext(url.searchParams.get('next'), '/account?welcome=1'));
	},
	backup: async ({ request, url }) => {
		const limited = await guard(request);
		if (limited) return limited;
		const parsed = backupCodeSchema.safeParse(formObject(await request.formData()));
		if (!parsed.success) return fail(400, { backup: true, errors: fieldErrors(parsed.error) });
		try {
			await auth.api.verifyBackupCode({
				body: { code: parsed.data.code },
				headers: request.headers
			});
		} catch (e) {
			if (e instanceof APIError)
				return fail(400, { backup: true, errors: { code: 'err_code_wrong' } });
			throw e;
		}
		redirect(303, safeNext(url.searchParams.get('next'), '/account?welcome=1'));
	}
};
