/**
 * Password hashing that fits a Cloudflare Worker's CPU budget.
 *
 * Better Auth's default (scrypt in plain JavaScript) takes ~80 ms of CPU per check, which
 * goes over the Workers free-plan limit and shows people a Cloudflare error page at login.
 * PBKDF2-SHA256 runs natively through WebCrypto (~14 ms at 100,000 rounds, the most Workers
 * allow). Old scrypt hashes still work and are upgraded the next time that person signs in.
 */
import { verifyPassword as verifyScrypt } from 'better-auth/crypto';

const ROUNDS = 100_000;
const PREFIX = 'pbkdf2$';

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) =>
	Uint8Array.from(atob(s), (c) => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, rounds: number) {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(password.normalize('NFKC')),
		'PBKDF2',
		false,
		['deriveBits']
	);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: rounds },
		key,
		256
	);
	return new Uint8Array(bits);
}

export async function hashPassword(password: string) {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const key = await derive(password, salt, ROUNDS);
	return [PREFIX + ROUNDS, b64(salt), b64(key)].join('$');
}

/** Same-length comparison that does not stop at the first difference. */
function same(a: Uint8Array, b: Uint8Array) {
	if (a.length !== b.length) return false;
	let r = 0;
	for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i];
	return r === 0;
}

export async function verifyPassword({ hash, password }: { hash: string; password: string }) {
	if (!hash.startsWith(PREFIX)) return verifyScrypt({ hash, password });
	const [, rounds, salt, key] = hash.split('$');
	const n = Number(rounds);
	if (!Number.isInteger(n) || n < 1 || n > ROUNDS || !salt || !key) return false;
	try {
		return same(await derive(password, unb64(salt), n), unb64(key));
	} catch {
		return false;
	}
}

export const isOldHash = (hash: string | null | undefined) => !!hash && !hash.startsWith(PREFIX);
