import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireTutor } from '#lib/server/guards.ts';
import { toolsEnv } from '#lib/server/tools/env.ts';
import { connections, disconnect, providerConfigured } from '#lib/server/tools/oauth.ts';
import { getToolPref, setToolPref } from '#lib/server/tools/meetings.ts';
import { formObject } from '#lib/validation/auth.ts';

const flashKeys = new Set([
	'tools6_not_ready',
	'tools6_err_cancelled',
	'tools6_err_state',
	'tools6_err_exchange',
	'tools6_err_not_for_you'
]);

export const load: PageServerLoad = async ({ locals, url }) => {
	const t = requireTutor(locals.user, url).id;
	const env = toolsEnv(url);
	const err = url.searchParams.get('error');
	const connected = url.searchParams.get('connected');
	return {
		conn: await connections(locals.db, t),
		ready: {
			google: providerConfigured(env, 'google'),
			microsoft: providerConfigured(env, 'microsoft')
		},
		pref: await getToolPref(locals.db, t),
		flashError: err && flashKeys.has(err) ? err : null,
		flashConnected: connected === 'google' || connected === 'microsoft' ? connected : null
	};
};

export const actions: Actions = {
	disconnect: async ({ locals, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		const f = formObject(await request.formData());
		if (f.provider !== 'google' && f.provider !== 'microsoft')
			return fail(400, { error: 'err_generic' });
		await disconnect(locals.db, toolsEnv(url), t, f.provider);
		// lessons go back to the low-data room when their tool is gone
		const pref = await getToolPref(locals.db, t);
		if (
			(f.provider === 'google' && pref.meetingTool === 'meet') ||
			(f.provider === 'microsoft' && pref.meetingTool === 'teams')
		)
			await setToolPref(locals.db, t, { meetingTool: 'room' });
		return { disconnected: f.provider };
	},
	meeting: async ({ locals, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		const f = formObject(await request.formData());
		const v = f.tool;
		if (v !== 'room' && v !== 'meet' && v !== 'teams') return fail(400, { error: 'err_generic' });
		const conn = await connections(locals.db, t);
		if ((v === 'meet' && !conn.meet) || (v === 'teams' && !conn.teams))
			return fail(400, { error: 'tools6_err_connect_first' });
		await setToolPref(locals.db, t, { meetingTool: v });
		return { saved: true };
	},
	kahoot: async ({ locals, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		const f = formObject(await request.formData());
		await setToolPref(locals.db, t, { kahootOn: f.on === '1' });
		return { saved: true };
	}
};
