import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { toolsEnv } from '#lib/server/tools/env.ts';
import {
	beginAuth,
	providerConfigured,
	STATE_COOKIE,
	STATE_MAX_AGE
} from '#lib/server/tools/oauth.ts';
import {
	connectBlocked,
	providerParam,
	requireToolUser,
	toolsPagePath
} from '#lib/server/tools/access.ts';

/**
 * Start connecting Google or Microsoft: a link (GET), so the browser goes straight to the
 * provider. The state and PKCE verifier stay in an encrypted httpOnly cookie bound to the
 * signed-in person; nothing is stored until the provider sends them back.
 */
export const GET: RequestHandler = async ({ locals, url, params, cookies }) => {
	const p = providerParam(params.provider);
	const { user, role } = requireToolUser(locals.user, url);
	const back = toolsPagePath(role);
	const env = toolsEnv(url);
	if (!providerConfigured(env, p)) redirect(303, `${back}?error=tools6_not_ready`);
	const blocked = await connectBlocked(locals.db, role, user.id, p);
	if (blocked) redirect(303, `${back}?error=${blocked}`);
	const { url: go, cookie } = await beginAuth(env, p, user.id, role);
	cookies.set(STATE_COOKIE, cookie, {
		path: '/tools/callback',
		httpOnly: true,
		sameSite: 'lax',
		secure: url.protocol === 'https:',
		maxAge: STATE_MAX_AGE
	});
	redirect(303, go);
};
