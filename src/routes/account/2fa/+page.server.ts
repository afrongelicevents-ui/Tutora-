import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import type { DB } from '#lib/server/db/types.ts';
import { requireUser } from '#lib/server/guards.ts';
import { hitLimit, clientIp } from '#lib/server/rate-limit.ts';
import { qrDataUrl, totpSecret } from '#lib/server/qr.ts';
import { fieldErrors, formObject, totpCodeSchema } from '#lib/validation/auth.ts';

const passwordSchema = z.object({
	password: z.string().min(1, 'err_required').max(128, 'err_too_long')
});
const setupSchema = z.object({
	totpURI: z.string().startsWith('otpauth://totp/').max(512),
	backupCodes: z.string().max(2000)
});

export const load: PageServerLoad = ({ locals, url }) => {
	const user = requireUser(locals.user, url);
	return {
		enabled: user.twoFactorEnabled,
		isTutor: user.role === 'tutor',
		required: url.searchParams.has('required')
	};
};

function setupView(totpURI: string, backupCodes: string[]) {
	return { totpURI, qr: qrDataUrl(totpURI), secret: totpSecret(totpURI), backupCodes };
}

async function limited(db: DB, request: Request, userId: string) {
	const l = await hitLimit(db, 'twoFactor', `${clientIp(request)}:${userId}`);
	return l.ok ? null : fail(429, { errors: { form: 'err_rate_limited' }, retryMinutes: 1 });
}

export const actions: Actions = {
	start: async ({ request, locals, url }) => {
		const user = requireUser(locals.user, url);
		const tooMany = await limited(locals.db, request, user.id);
		if (tooMany) return tooMany;
		const parsed = passwordSchema.safeParse(formObject(await request.formData()));
		if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error) });
		try {
			const res = await locals.auth.api.enableTwoFactor({
				body: { password: parsed.data.password },
				headers: request.headers
			});
			if (res.method !== 'totp') return fail(500, { errors: { form: 'err_generic' } });
			return { setup: setupView(res.totpURI, res.backupCodes) };
		} catch (e) {
			if (e instanceof APIError) return fail(400, { errors: { password: 'err_password_wrong' } });
			throw e;
		}
	},
	verify: async ({ request, locals, url }) => {
		const user = requireUser(locals.user, url);
		const tooMany = await limited(locals.db, request, user.id);
		if (tooMany) return tooMany;
		const raw = formObject(await request.formData());
		const setup = setupSchema.safeParse(raw);
		if (!setup.success) return fail(400, { errors: { form: 'err_generic' } });
		const view = setupView(setup.data.totpURI, setup.data.backupCodes.split(',').filter(Boolean));
		const parsed = totpCodeSchema.safeParse(raw);
		if (!parsed.success) return fail(400, { setup: view, errors: fieldErrors(parsed.error) });
		try {
			await locals.auth.api.verifyTOTP({
				body: { code: parsed.data.code },
				headers: request.headers
			});
		} catch (e) {
			if (e instanceof APIError)
				return fail(400, { setup: view, errors: { code: 'err_code_wrong' } });
			throw e;
		}
		redirect(303, user.role === 'tutor' ? '/tutor' : '/account');
	},
	disable: async ({ request, locals, url }) => {
		const user = requireUser(locals.user, url);
		// The tutor account must keep 2FA on (checked on the server, not just hidden in the UI).
		if (user.role === 'tutor') return fail(403, { errors: { form: 'twofa_disable_tutor_note' } });
		const tooMany = await limited(locals.db, request, user.id);
		if (tooMany) return tooMany;
		const parsed = passwordSchema.safeParse(formObject(await request.formData()));
		if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error) });
		try {
			await locals.auth.api.disableTwoFactor({
				body: { password: parsed.data.password },
				headers: request.headers
			});
		} catch (e) {
			if (e instanceof APIError) return fail(400, { errors: { password: 'err_password_wrong' } });
			throw e;
		}
		redirect(303, '/account');
	}
};
