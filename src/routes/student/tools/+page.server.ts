import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { toolsAllowedFor } from '#lib/server/family.ts';
import { toolsEnv } from '#lib/server/tools/env.ts';
import { connections, disconnect, providerConfigured } from '#lib/server/tools/oauth.ts';
import { getToolPref, setToolPref } from '#lib/server/tools/meetings.ts';
import { formObject } from '#lib/validation/auth.ts';

const flashKeys = new Set([
	'tools6_not_ready',
	'tools6_err_cancelled',
	'tools6_err_state',
	'tools6_err_exchange',
	'tools6_err_not_for_you',
	'tools6_err_guardian'
]);

export const load: PageServerLoad = async ({ locals, url }) => {
	const s = requireRole(locals.user, url, ['student']).id;
	const err = url.searchParams.get('error');
	const c = await connections(locals.db, s);
	return {
		// students only ever connect Google for Drive files they pick
		drive: c.drive,
		driveEmail: c.google?.email ?? null,
		googleConnected: !!c.google,
		ready: providerConfigured(toolsEnv(url), 'google'),
		allowed: await toolsAllowedFor(locals.db, s),
		pref: await getToolPref(locals.db, s),
		flashError: err && flashKeys.has(err) ? err : null,
		flashConnected: url.searchParams.get('connected') === 'google'
	};
};

export const actions: Actions = {
	disconnect: async ({ locals, url }) => {
		const s = requireRole(locals.user, url, ['student']).id;
		await disconnect(locals.db, toolsEnv(url), s, 'google');
		return { disconnected: true };
	},
	kahoot: async ({ locals, url, request }) => {
		const s = requireRole(locals.user, url, ['student']).id;
		const f = formObject(await request.formData());
		if (f.on !== '0' && f.on !== '1') return fail(400, { error: 'err_generic' });
		await setToolPref(locals.db, s, { kahootOn: f.on === '1' });
		return { saved: true };
	}
};
