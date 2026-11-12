import { APIError } from 'better-auth/api';
import type { Auth } from '../auth-config.ts';
import { loginSchema, fieldErrors } from '../../validation/auth.ts';
import { loginEmail } from '../family.ts';

export type LoginResult =
	{ ok: true; twoFactor: boolean } | { ok: false; errors: Record<string, string> };

export async function logIn(
	deps: { auth: Auth },
	input: Record<string, string>,
	headers: Headers
): Promise<LoginResult> {
	// younger children log in with a username instead of an email
	const parsed = loginSchema.safeParse({ ...input, email: loginEmail(input.email ?? '') });
	if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
	try {
		const res = (await deps.auth.api.signInEmail({
			body: {
				email: parsed.data.email,
				password: parsed.data.password,
				callbackURL: '/account',
				// "Stay logged in on this phone" (ticked by default): 30 days; otherwise until the browser closes
				rememberMe: input.remember === 'on'
			},
			headers
		})) as { twoFactorRedirect?: boolean };
		return { ok: true, twoFactor: !!res?.twoFactorRedirect };
	} catch (e) {
		if (e instanceof APIError) {
			const code = String((e.body as { code?: string } | undefined)?.code ?? '');
			if (code === 'EMAIL_NOT_VERIFIED') return { ok: false, errors: { form: 'login_unverified' } };
			if (e.statusCode === 401 || code.includes('INVALID'))
				return { ok: false, errors: { form: 'err_login' } };
		}
		throw e;
	}
}
