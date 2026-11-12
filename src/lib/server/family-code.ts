import type { Cookies } from '@sveltejs/kit';
import { dev } from '$app/env';
import { BETTER_AUTH_SECRET } from '$app/env/private';
import { normalizeInvite } from './family.ts';

/**
 * The code a parent typed is kept in a short-lived, http-only cookie while they create an
 * account or sign in. The cookie is SIGNED by the server (HMAC) and only made after /code
 * accepted the code under its rate limit, so a changed cookie can't be used to guess codes.
 * The code itself still works only once and only until it expires.
 */
const NAME = 'tutora_family_code';
const LIFETIME_S = 6 * 60 * 60;

async function sign(text: string, secret = BETTER_AUTH_SECRET) {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(`family-code:${secret}`),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
	return Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sealCode(code: string, now = Date.now(), secret?: string) {
	const plain = normalizeInvite(code);
	const until = now + LIFETIME_S * 1000;
	return `${plain}.${until}.${await sign(`${plain}.${until}`, secret)}`;
}

export async function openCode(value: string | undefined, now = Date.now(), secret?: string) {
	const m = /^([A-Z0-9]{9})\.(\d{13})\.([0-9a-f]{64})$/.exec(value ?? '');
	if (!m || Number(m[2]) < now) return null;
	const expected = await sign(`${m[1]}.${m[2]}`, secret);
	let diff = 0;
	for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ m[3].charCodeAt(i);
	return diff === 0 ? m[1] : null;
}

export async function rememberCode(cookies: Cookies, code: string) {
	cookies.set(NAME, await sealCode(code), {
		path: '/',
		httpOnly: true,
		secure: !dev,
		sameSite: 'lax',
		maxAge: LIFETIME_S
	});
}

export function rememberedCode(cookies: Cookies): Promise<string | null> {
	return openCode(cookies.get(NAME));
}

export function forgetCode(cookies: Cookies) {
	cookies.delete(NAME, { path: '/' });
}
