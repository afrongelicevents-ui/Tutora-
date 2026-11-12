/**
 * Encryption for Connected Tools tokens (and the short-lived OAuth state cookie).
 *
 * AES-256-GCM with WebCrypto (works on Cloudflare Workers and Node). The key is derived with
 * HKDF-SHA-256 from TOOLS_KEY, or from BETTER_AUTH_SECRET when TOOLS_KEY is not set. Every
 * value is bound to a context ("additional data", e.g. the user id and provider), so an
 * encrypted token copied to another row or another purpose does not decrypt.
 *
 * Tokens are only ever decrypted on the server, right before calling the provider. They are
 * never sent to the browser and never logged.
 */

export interface KeySource {
	secret: string;
	TOOLS_KEY?: string;
}

const enc = new TextEncoder();
const dec = new TextDecoder();
const VERSION = 'v1';
const keys = new Map<string, Promise<CryptoKey>>();

/** base64url without padding */
export function b64url(bytes: Uint8Array): string {
	let s = '';
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64url(s: string): Uint8Array<ArrayBuffer> {
	const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
	const out = new Uint8Array(b.length);
	for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
	return out;
}

/** The AES key for this site. Throws when no usable secret is configured. */
export function toolsKey(src: KeySource): Promise<CryptoKey> {
	const material = src.TOOLS_KEY || src.secret;
	if (!material || material.length < 32)
		throw new Error('tools key: TOOLS_KEY or BETTER_AUTH_SECRET must be at least 32 characters');
	const label = src.TOOLS_KEY ? 'tools-key' : 'auth-secret';
	const cacheKey = `${label}:${material}`;
	let k = keys.get(cacheKey);
	if (!k) {
		k = (async () => {
			const base = await crypto.subtle.importKey('raw', enc.encode(material), 'HKDF', false, [
				'deriveKey'
			]);
			return crypto.subtle.deriveKey(
				{
					name: 'HKDF',
					hash: 'SHA-256',
					salt: enc.encode('tutora/connected-tools'),
					info: enc.encode(`tutora tools token encryption v1 (${label})`)
				},
				base,
				{ name: 'AES-GCM', length: 256 },
				false,
				['encrypt', 'decrypt']
			);
		})();
		keys.set(cacheKey, k);
	}
	return k;
}

/** Encrypt text. `context` must be given again to decrypt (e.g. `token:<userId>:google`). */
export async function encryptText(src: KeySource, plain: string, context: string): Promise<string> {
	const key = await toolsKey(src);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ct = new Uint8Array(
		await crypto.subtle.encrypt(
			{ name: 'AES-GCM', iv, additionalData: enc.encode(context) },
			key,
			enc.encode(plain)
		)
	);
	return `${VERSION}.${b64url(iv)}.${b64url(ct)}`;
}

/** Decrypt; returns null when the value was changed, made for another context or another key. */
export async function decryptText(
	src: KeySource,
	sealed: string,
	context: string
): Promise<string | null> {
	const [v, ivS, ctS] = sealed.split('.');
	if (v !== VERSION || !ivS || !ctS) return null;
	try {
		const key = await toolsKey(src);
		const plain = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: fromB64url(ivS), additionalData: enc.encode(context) },
			key,
			fromB64url(ctS)
		);
		return dec.decode(plain);
	} catch {
		return null;
	}
}

/** Context used for a stored token: binds it to one person and one provider. */
export const tokenContext = (userId: string, provider: string, kind: 'access' | 'refresh') =>
	`token:${kind}:${userId}:${provider}`;

/** Random URL-safe text (state, PKCE verifier). */
export function randomToken(bytes = 32): string {
	return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** PKCE S256 challenge for a verifier. */
export async function pkceChallenge(verifier: string): Promise<string> {
	const h = await crypto.subtle.digest('SHA-256', enc.encode(verifier));
	return b64url(new Uint8Array(h));
}

/** Constant-time comparison of two strings. */
export function sameText(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let d = 0;
	for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return d === 0;
}
