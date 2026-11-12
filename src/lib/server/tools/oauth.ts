/**
 * OAuth 2.0 for Connected Tools: authorization code flow with PKCE (S256) and a `state`
 * kept in an encrypted, httpOnly cookie that is bound to the signed-in person.
 *
 * Google (tutors: Meet links via Calendar + Drive files they pick; students: Drive files they
 * pick only) and Microsoft (tutors only: Teams meetings). Tokens are stored encrypted in
 * connected_account and never leave the server.
 */
import { and, eq } from 'drizzle-orm';
import type { DB } from '../db/types.ts';
import { connectedAccount, type Provider } from '../db/v3.schema.ts';
import type { ToolsEnv } from './meetings.ts';
import {
	decryptText,
	encryptText,
	fromB64url,
	pkceChallenge,
	randomToken,
	sameText,
	tokenContext
} from './crypto.ts';

export const G_CALENDAR = 'https://www.googleapis.com/auth/calendar.events';
export const G_DRIVE_FILE = 'https://www.googleapis.com/auth/drive.file';
export const MS_MEETINGS = 'OnlineMeetings.ReadWrite';

export const PROVIDER_URLS = {
	google: {
		authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
		token: 'https://oauth2.googleapis.com/token',
		revoke: 'https://oauth2.googleapis.com/revoke'
	},
	microsoft: {
		authorize: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
		token: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
		revoke: null
	}
} as const;

export type ToolRole = 'tutor' | 'student';

export function isProvider(p: string): p is Provider {
	return p === 'google' || p === 'microsoft';
}

/** Is this provider's OAuth app configured on this site? (no fake connections otherwise) */
export function providerConfigured(env: ToolsEnv, p: Provider): boolean {
	return p === 'google'
		? !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
		: !!(env.MS_CLIENT_ID && env.MS_CLIENT_SECRET);
}

/** Can a person with this role connect this provider at all? */
export function providerAllowed(role: ToolRole, p: Provider): boolean {
	return p === 'google' || role === 'tutor';
}

/** The scopes we ask for: as few as each role needs. */
export function scopesFor(p: Provider, role: ToolRole): string[] {
	if (p === 'microsoft') return ['openid', 'email', 'offline_access', MS_MEETINGS, 'User.Read'];
	return role === 'tutor'
		? ['openid', 'email', G_CALENDAR, G_DRIVE_FILE]
		: ['openid', 'email', G_DRIVE_FILE];
}

function client(env: ToolsEnv, p: Provider) {
	return p === 'google'
		? { id: env.GOOGLE_CLIENT_ID ?? '', secret: env.GOOGLE_CLIENT_SECRET ?? '' }
		: { id: env.MS_CLIENT_ID ?? '', secret: env.MS_CLIENT_SECRET ?? '' };
}

export const redirectUri = (env: ToolsEnv, p: Provider) => `${env.origin}/tools/callback/${p}`;

/* ------------------------------------------------------------------ state cookie */

export const STATE_COOKIE = 'tutora_tools_oauth';
export const STATE_MAX_AGE = 600; // seconds

interface StateData {
	u: string; // user id
	p: Provider;
	s: string; // state
	v: string; // PKCE verifier
	r: ToolRole;
	t: number; // created (ms)
}

const stateContext = (userId: string, p: Provider) => `oauth-state:${userId}:${p}`;

/** Start a connection: the provider URL to send the person to, and the sealed cookie value. */
export async function beginAuth(
	env: ToolsEnv,
	p: Provider,
	userId: string,
	role: ToolRole,
	now = Date.now()
): Promise<{ url: string; cookie: string }> {
	const state = randomToken(24);
	const verifier = randomToken(48);
	const data: StateData = { u: userId, p, s: state, v: verifier, r: role, t: now };
	const cookie = await encryptText(env, JSON.stringify(data), stateContext(userId, p));
	const q = new URLSearchParams({
		client_id: client(env, p).id,
		redirect_uri: redirectUri(env, p),
		response_type: 'code',
		scope: scopesFor(p, role).join(' '),
		state,
		code_challenge: await pkceChallenge(verifier),
		code_challenge_method: 'S256'
	});
	if (p === 'google') {
		q.set('access_type', 'offline');
		q.set('prompt', 'consent');
		q.set('include_granted_scopes', 'true');
	} else {
		q.set('response_mode', 'query');
		q.set('prompt', 'select_account');
	}
	return { url: `${PROVIDER_URLS[p].authorize}?${q}`, cookie };
}

/** Check the callback's state against the cookie. Returns the verifier and role, or null. */
export async function checkState(
	env: ToolsEnv,
	p: Provider,
	userId: string,
	cookie: string | undefined,
	state: string | null,
	now = Date.now()
): Promise<{ verifier: string; role: ToolRole } | null> {
	if (!cookie || !state) return null;
	const plain = await decryptText(env, cookie, stateContext(userId, p));
	if (!plain) return null;
	let d: StateData;
	try {
		d = JSON.parse(plain);
	} catch {
		return null;
	}
	if (d.u !== userId || d.p !== p || typeof d.s !== 'string') return null;
	if (!sameText(d.s, state)) return null;
	if (!(now - d.t >= 0 && now - d.t <= STATE_MAX_AGE * 1000)) return null;
	return { verifier: d.v, role: d.r };
}

/* ------------------------------------------------------------------ tokens */

export interface TokenResponse {
	access_token: string;
	expires_in?: number;
	refresh_token?: string;
	scope?: string;
	id_token?: string;
}

const fetchOf = (env: ToolsEnv) => env.fetch ?? fetch;

async function tokenRequest(
	env: ToolsEnv,
	p: Provider,
	body: Record<string, string>
): Promise<TokenResponse | { error: string }> {
	const c = client(env, p);
	const res = await fetchOf(env)(PROVIDER_URLS[p].token, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
		body: new URLSearchParams({ client_id: c.id, client_secret: c.secret, ...body })
	});
	const j = (await res.json().catch(() => ({}))) as Partial<TokenResponse> & { error?: string };
	if (!res.ok || !j.access_token) return { error: j.error || `http_${res.status}` };
	return j as TokenResponse;
}

/** Swap the authorization code for tokens (PKCE verifier required). */
export function exchangeCode(env: ToolsEnv, p: Provider, code: string, verifier: string) {
	return tokenRequest(env, p, {
		grant_type: 'authorization_code',
		code,
		code_verifier: verifier,
		redirect_uri: redirectUri(env, p)
	});
}

/**
 * The email in the id_token. The token came straight from the provider's token endpoint
 * over TLS, so (as OpenID Connect allows) its signature need not be checked here; it is
 * only used as a label ("connected as ...").
 */
export function emailFromIdToken(idToken: string | undefined): string | null {
	if (!idToken) return null;
	try {
		const payload = JSON.parse(new TextDecoder().decode(fromB64url(idToken.split('.')[1] ?? '')));
		const e = payload.email || payload.preferred_username || payload.upn;
		return typeof e === 'string' ? e.slice(0, 200) : null;
	} catch {
		return null;
	}
}

/** Store (or replace) the connection, tokens encrypted. */
export async function saveAccount(
	db: DB,
	env: ToolsEnv,
	userId: string,
	p: Provider,
	t: TokenResponse,
	requestedScopes: string[],
	now = new Date()
) {
	const scopes = (t.scope ?? requestedScopes.join(' ')).trim();
	const values = {
		userId,
		provider: p,
		accountEmail: emailFromIdToken(t.id_token),
		scopes,
		accessTokenEnc: await encryptText(env, t.access_token, tokenContext(userId, p, 'access')),
		refreshTokenEnc: t.refresh_token
			? await encryptText(env, t.refresh_token, tokenContext(userId, p, 'refresh'))
			: null,
		expiresAt: t.expires_in ? new Date(now.getTime() + t.expires_in * 1000) : null,
		connectedAt: now
	};
	// keep an earlier refresh token if the provider did not send a new one
	const set: Partial<typeof values> = { ...values };
	if (!values.refreshTokenEnc) delete set.refreshTokenEnc;
	await db
		.insert(connectedAccount)
		.values(values)
		.onConflictDoUpdate({ target: [connectedAccount.userId, connectedAccount.provider], set });
}

export async function getAccount(db: DB, userId: string, p: Provider) {
	const [a] = await db
		.select()
		.from(connectedAccount)
		.where(and(eq(connectedAccount.userId, userId), eq(connectedAccount.provider, p)));
	return a ?? null;
}

/** Was this scope granted? (Microsoft may answer with full Graph URLs.) */
export function hasScope(scopes: string | null | undefined, s: string) {
	const want = s.toLowerCase();
	return (scopes ?? '')
		.split(/\s+/)
		.map((x) => x.toLowerCase())
		.some((x) => x === want || x.endsWith('/' + want));
}

/**
 * A working access token for this person and provider (refreshed when it expires within a
 * minute). Null when not connected, the needed scope was not granted, or the grant was
 * revoked at the provider (then the connection is removed, so the page tells the truth).
 */
export async function accessToken(
	db: DB,
	env: ToolsEnv,
	userId: string,
	p: Provider,
	needScope?: string,
	now = new Date()
): Promise<string | null> {
	if (!providerConfigured(env, p)) return null;
	const a = await getAccount(db, userId, p);
	if (!a) return null;
	if (needScope && !hasScope(a.scopes, needScope)) return null;
	const fresh = !a.expiresAt || a.expiresAt.getTime() - 60_000 > now.getTime();
	if (fresh) {
		const tok = await decryptText(env, a.accessTokenEnc, tokenContext(userId, p, 'access'));
		if (tok) return tok;
	}
	if (!a.refreshTokenEnc) return null;
	const refresh = await decryptText(env, a.refreshTokenEnc, tokenContext(userId, p, 'refresh'));
	if (!refresh) return null;
	const body: Record<string, string> = { grant_type: 'refresh_token', refresh_token: refresh };
	if (p === 'microsoft') body.scope = scopesFor('microsoft', 'tutor').join(' ');
	const r = await tokenRequest(env, p, body);
	if ('error' in r) {
		if (r.error === 'invalid_grant') await removeAccount(db, userId, p);
		return null;
	}
	await db
		.update(connectedAccount)
		.set({
			accessTokenEnc: await encryptText(env, r.access_token, tokenContext(userId, p, 'access')),
			...(r.refresh_token
				? {
						refreshTokenEnc: await encryptText(
							env,
							r.refresh_token,
							tokenContext(userId, p, 'refresh')
						)
					}
				: {}),
			...(r.scope ? { scopes: r.scope } : {}),
			expiresAt: r.expires_in ? new Date(now.getTime() + r.expires_in * 1000) : null
		})
		.where(and(eq(connectedAccount.userId, userId), eq(connectedAccount.provider, p)));
	return r.access_token;
}

async function removeAccount(db: DB, userId: string, p: Provider) {
	await db
		.delete(connectedAccount)
		.where(and(eq(connectedAccount.userId, userId), eq(connectedAccount.provider, p)));
}

/**
 * Disconnect: revoke the grant where the provider supports it (Google), then delete the row.
 * Microsoft has no endpoint to revoke one app's delegated token; the row (and so our only
 * copy of the token) is deleted and the person can also remove the app in their account.
 */
export async function disconnect(db: DB, env: ToolsEnv, userId: string, p: Provider) {
	const a = await getAccount(db, userId, p);
	if (!a) return { revoked: false };
	let revoked = false;
	const url = PROVIDER_URLS[p].revoke;
	if (url) {
		const tok =
			(a.refreshTokenEnc &&
				(await decryptText(env, a.refreshTokenEnc, tokenContext(userId, p, 'refresh')))) ||
			(await decryptText(env, a.accessTokenEnc, tokenContext(userId, p, 'access')));
		if (tok) {
			try {
				const res = await fetchOf(env)(url, {
					method: 'POST',
					headers: { 'content-type': 'application/x-www-form-urlencoded' },
					body: new URLSearchParams({ token: tok })
				});
				revoked = res.ok;
			} catch {
				revoked = false;
			}
		}
	}
	await removeAccount(db, userId, p);
	return { revoked };
}

/** What the tools pages show: connection labels only, never tokens. */
export async function connections(db: DB, userId: string) {
	const rows = await db
		.select({
			provider: connectedAccount.provider,
			email: connectedAccount.accountEmail,
			scopes: connectedAccount.scopes,
			connectedAt: connectedAccount.connectedAt
		})
		.from(connectedAccount)
		.where(eq(connectedAccount.userId, userId));
	const by = (p: Provider) => rows.find((r) => r.provider === p) ?? null;
	const google = by('google');
	const microsoft = by('microsoft');
	return {
		google: google && { email: google.email, connectedAt: google.connectedAt },
		microsoft: microsoft && { email: microsoft.email, connectedAt: microsoft.connectedAt },
		meet: !!google && hasScope(google.scopes, G_CALENDAR),
		drive: !!google && hasScope(google.scopes, G_DRIVE_FILE),
		teams: !!microsoft && hasScope(microsoft.scopes, MS_MEETINGS)
	};
}
