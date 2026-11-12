import type { Cookies } from '@sveltejs/kit';
import { dev } from '$app/env';
import { normalizeInvite } from './family.ts';

/**
 * The code a parent typed is kept in a short-lived, http-only cookie while they create an
 * account or sign in (and, with email confirmation, until they come back). The code still
 * works only once and only until it expires.
 */
const NAME = 'tutora_family_code';

export function rememberCode(cookies: Cookies, code: string) {
	cookies.set(NAME, normalizeInvite(code), {
		path: '/',
		httpOnly: true,
		secure: !dev,
		sameSite: 'lax',
		maxAge: 48 * 60 * 60
	});
}

export function rememberedCode(cookies: Cookies): string | null {
	const v = cookies.get(NAME);
	return v && /^[A-Z0-9]{9}$/.test(v) ? v : null;
}

export function forgetCode(cookies: Cookies) {
	cookies.delete(NAME, { path: '/' });
}
