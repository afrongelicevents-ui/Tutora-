import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { readResetLink, useResetLink } from '#lib/server/reset-links.ts';
import { clientIp, hitLimit } from '#lib/server/rate-limit.ts';
import { fieldErrors, formObject, resetSchema } from '#lib/validation/auth.ts';

/** A one-time reset link from the Tutora team: choose a new password (works once, 24 hours). */
export const load: PageServerLoad = async ({ locals, params, setHeaders }) => {
	// the link's secret is in the address: never kept by a browser cache or sent onwards
	setHeaders({ 'cache-control': 'private, no-store', 'referrer-policy': 'same-origin' });
	const r = await readResetLink(locals.db, params.token);
	return r.ok
		? { ok: true as const, name: r.name.split(' ')[0] || r.name }
		: { ok: false as const };
};

export const actions: Actions = {
	default: async ({ locals, params, request }) => {
		const limit = await hitLimit(locals.db, 'resetLinkUse', clientIp(request));
		if (!limit.ok) return fail(429, { errors: { form: 'err_rate_limited' } });
		const parsed = resetSchema.safeParse({
			...formObject(await request.formData()),
			token: params.token
		});
		if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error) });
		const ctx = await locals.auth.$context;
		const r = await useResetLink(
			{ db: locals.db, hashPassword: (pw) => ctx.password.hash(pw) },
			params.token,
			parsed.data.password
		);
		if (!r.ok) return fail(400, { gone: true });
		redirect(303, '/login?reset=1');
	}
};
