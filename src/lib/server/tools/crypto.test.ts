import { describe, expect, it } from 'vitest';
import {
	b64url,
	decryptText,
	encryptText,
	fromB64url,
	pkceChallenge,
	randomToken,
	sameText,
	tokenContext
} from './crypto.ts';
import {
	beginAuth,
	checkState,
	emailFromIdToken,
	hasScope,
	scopesFor,
	STATE_MAX_AGE
} from './oauth.ts';
import type { ToolsEnv } from './meetings.ts';

const env: ToolsEnv = {
	origin: 'https://tutora.example',
	secret: 'auth-secret-auth-secret-auth-secret-123',
	GOOGLE_CLIENT_ID: 'gid.apps.googleusercontent.com',
	GOOGLE_CLIENT_SECRET: 'gsecret',
	MS_CLIENT_ID: 'msid',
	MS_CLIENT_SECRET: 'mssecret'
};

describe('token encryption', () => {
	it('round-trips and never contains the plain token', async () => {
		const ctx = tokenContext('u1', 'google', 'access');
		const sealed = await encryptText(env, 'ya29.secret-token', ctx);
		expect(sealed.startsWith('v1.')).toBe(true);
		expect(sealed).not.toContain('secret-token');
		expect(await decryptText(env, sealed, ctx)).toBe('ya29.secret-token');
	});
	it('uses a fresh IV each time', async () => {
		const a = await encryptText(env, 'x', 'c');
		const b = await encryptText(env, 'x', 'c');
		expect(a).not.toBe(b);
	});
	it('fails for another user, another key, or a changed value', async () => {
		const sealed = await encryptText(env, 'tok', tokenContext('u1', 'google', 'access'));
		expect(await decryptText(env, sealed, tokenContext('u2', 'google', 'access'))).toBeNull();
		expect(await decryptText(env, sealed, tokenContext('u1', 'google', 'refresh'))).toBeNull();
		expect(
			await decryptText(
				{ ...env, TOOLS_KEY: 'k'.repeat(40) },
				sealed,
				tokenContext('u1', 'google', 'access')
			)
		).toBeNull();
		const parts = sealed.split('.');
		const ct = fromB64url(parts[2]);
		ct[0] ^= 1;
		expect(
			await decryptText(env, `v1.${parts[1]}.${b64url(ct)}`, tokenContext('u1', 'google', 'access'))
		).toBeNull();
		expect(await decryptText(env, 'garbage', 'c')).toBeNull();
	});
	it('prefers TOOLS_KEY when set', async () => {
		const withKey = { ...env, TOOLS_KEY: 'k'.repeat(40) };
		const sealed = await encryptText(withKey, 'tok', 'c');
		expect(await decryptText(withKey, sealed, 'c')).toBe('tok');
		expect(await decryptText(env, sealed, 'c')).toBeNull();
	});
	it('refuses short secrets', async () => {
		await expect(encryptText({ secret: 'short' }, 'x', 'c')).rejects.toThrow();
	});
	it('helpers', async () => {
		expect(fromB64url(b64url(new Uint8Array([0, 250, 255])))).toEqual(
			new Uint8Array([0, 250, 255])
		);
		expect(randomToken()).toMatch(/^[\w-]{43}$/);
		// RFC 7636 appendix B
		expect(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
			'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
		);
		expect(sameText('abc', 'abc')).toBe(true);
		expect(sameText('abc', 'abd')).toBe(false);
	});
});

describe('OAuth start and state', () => {
	it('builds the Google URL with PKCE, offline access and the tutor scopes', async () => {
		const { url, cookie } = await beginAuth(env, 'google', 'u1', 'tutor');
		const u = new URL(url);
		expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
		expect(u.searchParams.get('redirect_uri')).toBe('https://tutora.example/tools/callback/google');
		expect(u.searchParams.get('code_challenge_method')).toBe('S256');
		expect(u.searchParams.get('access_type')).toBe('offline');
		expect(u.searchParams.get('prompt')).toBe('consent');
		expect(u.searchParams.get('include_granted_scopes')).toBe('true');
		expect(u.searchParams.get('scope')).toContain('calendar.events');
		expect(cookie).not.toContain(u.searchParams.get('state')!);
		const ok = await checkState(env, 'google', 'u1', cookie, u.searchParams.get('state'));
		expect(ok?.role).toBe('tutor');
		expect(await pkceChallenge(ok!.verifier)).toBe(u.searchParams.get('code_challenge'));
	});
	it('students only ask for Drive files; Microsoft is for tutors', () => {
		expect(scopesFor('google', 'student')).toEqual([
			'openid',
			'email',
			'https://www.googleapis.com/auth/drive.file'
		]);
		expect(scopesFor('microsoft', 'tutor')).toContain('OnlineMeetings.ReadWrite');
	});
	it('rejects a wrong state, another user, another provider or an old cookie', async () => {
		const now = Date.now();
		const { url, cookie } = await beginAuth(env, 'microsoft', 'u1', 'tutor', now);
		const state = new URL(url).searchParams.get('state');
		expect(await checkState(env, 'microsoft', 'u1', cookie, 'nope')).toBeNull();
		expect(await checkState(env, 'microsoft', 'u2', cookie, state)).toBeNull();
		expect(await checkState(env, 'google', 'u1', cookie, state)).toBeNull();
		expect(await checkState(env, 'microsoft', 'u1', undefined, state)).toBeNull();
		expect(
			await checkState(env, 'microsoft', 'u1', cookie, state, now + STATE_MAX_AGE * 1000 + 1)
		).toBeNull();
		expect(await checkState(env, 'microsoft', 'u1', cookie, state, now + 1000)).not.toBeNull();
	});
	it('reads the email from an id_token and checks scopes', () => {
		const payload = b64url(
			new TextEncoder().encode(JSON.stringify({ email: 'tutor@example.com' }))
		);
		expect(emailFromIdToken(`x.${payload}.y`)).toBe('tutor@example.com');
		expect(emailFromIdToken('bad')).toBeNull();
		expect(
			hasScope(
				'openid https://graph.microsoft.com/OnlineMeetings.ReadWrite',
				'onlinemeetings.readwrite'
			)
		).toBe(true);
		expect(hasScope('openid email', 'https://www.googleapis.com/auth/drive.file')).toBe(false);
	});
});
