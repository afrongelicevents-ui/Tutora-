import { building, dev } from '$app/env';
import { DATABASE_URL, TEST_SITE } from '$app/env/private';
import { getSettings } from '#lib/server/settings.ts';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { type Handle, sequence } from '@sveltejs/kit/hooks';
import { makeAuth } from '#lib/server/auth.ts';
import { openDb } from '#lib/server/db/index.ts';
import { rememberForThisRequest } from '#lib/server/cache.ts';
import { cacheKey, cachedPage, forgetPages, keepPage } from '#lib/server/public-cache.ts';
import { getTextDirection } from '#lib/paraglide/runtime.js';
import { paraglideMiddleware } from '#lib/paraglide/server.js';
import { isAllowedAuthPath, securityHeaders } from '#lib/server/security.ts';
import { isRole } from '#lib/roles.ts';
import { areaAccess } from '#lib/server/guards.ts';

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		return resolve(
			{ ...event, request },
			{
				transformPageChunk: ({ html }) =>
					html
						.replace('%paraglide.lang%', locale)
						.replace('%paraglide.dir%', getTextDirection(locale))
			}
		);
	});

/** Opens this request's database connection and closes it when the response is ready. */
const handleDb: Handle = async ({ event, resolve }) => {
	if (building) return resolve(event);
	// reading pages use Neon's HTTP endpoint (cheaper CPU per query on Cloudflare, measured
	// with /api/perf-probe on the test site); form posts keep the WebSocket connection
	const { db, close } = await openDb(DATABASE_URL, { http: event.request.method === 'GET' });
	event.locals.db = db;
	// reading pages: the same lookup twice in one page runs once (never for form posts)
	if (event.request.method === 'GET') rememberForThisRequest(db);
	event.locals.auth = makeAuth(db);
	try {
		return await resolve(event);
	} finally {
		const done = close().catch(() => {});
		event.platform?.ctx?.waitUntil(done);
	}
};

const handleAuth: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;
	if (pathname === '/api/auth' || pathname.startsWith('/api/auth/')) {
		if (!isAllowedAuthPath(event.request.method, pathname)) {
			return new Response('Not found', { status: 404 });
		}
	}
	if (building) return resolve(event);
	const auth = event.locals.auth;
	const data = await auth.api.getSession({ headers: event.request.headers });
	if (data) {
		const role = isRole(data.user.role) ? data.user.role : 'student';
		event.locals.session = data.session;
		event.locals.user = {
			id: data.user.id,
			name: data.user.name,
			email: data.user.email,
			emailVerified: data.user.emailVerified,
			role,
			// the test site skips the authenticator step so shared test logins work
			twoFactorEnabled: !!data.user.twoFactorEnabled || TEST_SITE === '1',
			tutorStatus: null
		};
		if (role === 'tutor') {
			// the tutor's settings row (the layout and page need it too: read once per page)
			const p = await getSettings(event.locals.db, data.user.id).catch(() => null);
			event.locals.user.tutorStatus = p?.status ?? null;
		}
		{
			// read with the session already (Better Auth additional fields): no extra query
			const p = data.user as { mustChangePassword?: boolean | null; suspendedAt?: Date | null };
			const must = !!p.mustChangePassword;
			// an account suspended by the owner is treated as logged out
			if (p?.suspendedAt) {
				event.locals.user = undefined;
				event.locals.session = undefined;
			} else {
				// after a temporary password made by someone else: choose your own before anything else
				const path = event.url.pathname;
				if (must && path !== '/account/password' && path !== '/logout') {
					if (event.isDataRequest) return new Response('Forbidden', { status: 403 });
					return new Response(null, { status: 303, headers: { location: '/account/password' } });
				}
			}
		}
	}
	// Outer wall for /owner, /tutor and /student (also covers page-data requests).
	const gate = areaAccess(event.url.pathname, event.url.search, event.locals.user);
	if (!gate.ok) {
		if (gate.status === 303)
			return new Response(null, { status: 303, headers: { location: gate.location } });
		// page-data requests get a bare 403; people get a friendly page
		if (event.isDataRequest || event.url.pathname.endsWith('/__data.json'))
			return new Response('Forbidden', { status: 403 });
		return new Response(null, {
			status: 303,
			headers: { location: `/no-access?for=${gate.area}` }
		});
	}
	return svelteKitHandler({ event, resolve, auth, building });
};

const handleHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	for (const [k, v] of Object.entries(securityHeaders({ dev }))) {
		if (!response.headers.has(k)) response.headers.set(k, v);
	}
	// Pages for logged-in people must never be stored by shared caches.
	if (event.locals.user && !response.headers.has('cache-control')) {
		response.headers.set('cache-control', 'private, no-store');
	}
	return response;
};

/**
 * Public pages for logged-out visitors are served from memory for a minute (no rendering, no
 * database). Any form post clears them in this worker. See public-cache.ts.
 */
const handlePublicCache: Handle = async ({ event, resolve }) => {
	if (building) return resolve(event);
	if (event.request.method !== 'GET' && event.request.method !== 'HEAD') forgetPages();
	const key = cacheKey(event.request, event.url);
	if (!key) return resolve(event);
	const hit = cachedPage(key);
	if (hit) return hit;
	return keepPage(key, await resolve(event));
};

export const handle: Handle = sequence(
	handlePublicCache,
	handleHeaders,
	handleDb,
	handleParaglide,
	handleAuth
);
