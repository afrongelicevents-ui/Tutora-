import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { logIn } from '#lib/server/actions/login.ts';
import { hitLimit, clientIp, clearLimit, peekLimit } from '#lib/server/rate-limit.ts';
import { notifyUser } from '#lib/server/notify.ts';
import { m } from '#lib/paraglide/messages.js';
import { safeNext } from '#lib/server/guards.ts';
import { emailField, formObject } from '#lib/validation/auth.ts';
import { homeFor } from '#lib/roles.ts';
import { eq } from 'drizzle-orm';
import { user } from '#lib/server/db/auth.schema.ts';
import { endLogin } from '#lib/server/auth-cookies.ts';
import { loginEmail } from '#lib/server/family.ts';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeNext(url.searchParams.get('next'), homeFor(locals.user.role)));
};

export const actions: Actions = {
	default: async ({ request, url, locals, cookies }) => {
		const input = formObject(await request.formData());
		const values = { email: input.email ?? '' };
		// Key the limits on the cleaned-up email, so "a@b.com " and "A@B.com" share one bucket.
		const email = emailField.safeParse(loginEmail(input.email ?? ''));
		const who = email.success ? email.data : 'invalid';
		const ip = clientIp(request);
		const byIp = await hitLimit(locals.db, 'login', `${ip}:${who}`);
		const byAccount = await hitLimit(locals.db, 'loginAccount', who);
		const byIpOnly = await hitLimit(locals.db, 'loginIp', ip);
		const limit = !byIp.ok ? byIp : !byIpOnly.ok ? byIpOnly : byAccount;
		if (!limit.ok) {
			return fail(429, {
				values,
				errors: { form: 'err_rate_limited' },
				retryMinutes: Math.ceil(limit.retryAfterSeconds / 60)
			});
		}

		// locked after too many wrong passwords for this account (from any address)
		if (email.success) {
			const lock = await peekLimit(locals.db, 'loginFail', who);
			if (!lock.ok)
				return fail(429, {
					values,
					errors: { form: 'err_locked' },
					retryMinutes: Math.ceil(lock.retryAfterSeconds / 60)
				});
		}

		const result = await logIn({ auth: locals.auth }, input, request.headers);
		if (!result.ok) {
			if (email.success) {
				const fails = await hitLimit(locals.db, 'loginFail', who);
				// the account owner hears once, when the lock starts
				if (fails.remaining === 0) {
					const [acc] = await locals.db
						.select({ id: user.id })
						.from(user)
						.where(eq(user.email, email.data));
					if (acc)
						await notifyUser(locals.db, acc.id, m.login_locked_s(), m.login_locked_b(), {
							kind: 'account',
							link: '/forgot-password'
						});
				}
			}
			return fail(400, { values, errors: result.errors });
		}
		if (email.success) await clearLimit(locals.db, 'loginFail', who);
		// accounts suspended by the Tutora team cannot log in (checked only after the right
		// password, so this does not tell strangers which accounts exist)
		if (email.success) {
			const [acc] = await locals.db
				.select({ id: user.id, s: user.suspendedAt })
				.from(user)
				.where(eq(user.email, email.data));
			if (acc?.s) {
				await endLogin(locals.db, cookies, acc.id);
				return fail(403, { values, errors: { form: 'err_suspended' } });
			}
		}

		const next = url.searchParams.get('next');
		if (result.twoFactor) {
			redirect(303, `/login/2fa${next ? `?next=${encodeURIComponent(next)}` : ''}`);
		}
		// role is not known in this request yet; /account forwards to the right place
		redirect(303, safeNext(next, '/account?welcome=1'));
	}
};
