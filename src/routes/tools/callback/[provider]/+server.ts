import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { toolsEnv } from '#lib/server/tools/env.ts';
import {
	checkState,
	exchangeCode,
	providerConfigured,
	saveAccount,
	scopesFor,
	STATE_COOKIE
} from '#lib/server/tools/oauth.ts';
import {
	connectBlocked,
	providerParam,
	requireToolUser,
	toolsPagePath
} from '#lib/server/tools/access.ts';

/** The provider sends the person back here with a one-time code (or an error). */
export const GET: RequestHandler = async ({ locals, url, params, cookies }) => {
	const p = providerParam(params.provider);
	const { user, role } = requireToolUser(locals.user, url);
	const back = toolsPagePath(role);
	const env = toolsEnv(url);
	const cookie = cookies.get(STATE_COOKIE);
	cookies.delete(STATE_COOKIE, { path: '/tools/callback' });
	if (!providerConfigured(env, p)) redirect(303, `${back}?error=tools6_not_ready`);
	// the person said no, or the provider refused
	if (url.searchParams.get('error')) redirect(303, `${back}?error=tools6_err_cancelled`);
	const st = await checkState(env, p, user.id, cookie, url.searchParams.get('state'));
	const code = url.searchParams.get('code');
	if (!st || st.role !== role || !code) redirect(303, `${back}?error=tools6_err_state`);
	const blocked = await connectBlocked(locals.db, role, user.id, p);
	if (blocked) redirect(303, `${back}?error=${blocked}`);
	const tokens = await exchangeCode(env, p, code, st.verifier).catch(() => ({ error: 'network' }));
	if ('error' in tokens) redirect(303, `${back}?error=tools6_err_exchange`);
	await saveAccount(locals.db, env, user.id, p, tokens, scopesFor(p, role));
	redirect(303, `${back}?connected=${p}`);
};
