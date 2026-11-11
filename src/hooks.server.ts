import { building, dev } from '$app/env';
import { DATABASE_URL } from '$app/env/private';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { type Handle, sequence } from '@sveltejs/kit/hooks';
import { makeAuth } from '#lib/server/auth.ts';
import { openDb } from '#lib/server/db/index.ts';
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
	const { db, close } = await openDb(DATABASE_URL);
	event.locals.db = db;
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
			twoFactorEnabled: !!data.user.twoFactorEnabled
		};
	}
	// Outer wall for /tutor and /student (also covers page-data requests).
	const gate = areaAccess(event.url.pathname, event.url.search, event.locals.user);
	if (!gate.ok) {
		return gate.status === 303
			? new Response(null, { status: 303, headers: { location: gate.location } })
			: new Response('You do not have access to this page.', { status: 403 });
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

export const handle: Handle = sequence(handleHeaders, handleDb, handleParaglide, handleAuth);
