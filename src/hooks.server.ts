import { building, dev } from '$app/env';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { type Handle, sequence } from '@sveltejs/kit/hooks';
import { auth } from '#lib/server/auth.ts';
import { getTextDirection } from '#lib/paraglide/runtime.js';
import { paraglideMiddleware } from '#lib/paraglide/server.js';
import { isAllowedAuthPath, securityHeaders } from '#lib/server/security.ts';
import { isRole } from '#lib/roles.ts';

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

const handleAuth: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;
	if (pathname === '/api/auth' || pathname.startsWith('/api/auth/')) {
		if (!isAllowedAuthPath(event.request.method, pathname)) {
			return new Response('Not found', { status: 404 });
		}
	}
	if (!building) {
		const data = await auth.api.getSession({ headers: event.request.headers });
		if (data) {
			const role = isRole(data.user.role) ? data.user.role : 'student';
			event.locals.session = data.session;
			event.locals.user = { ...data.user, role, twoFactorEnabled: !!data.user.twoFactorEnabled };
		}
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

export const handle: Handle = sequence(handleHeaders, handleParaglide, handleAuth);
