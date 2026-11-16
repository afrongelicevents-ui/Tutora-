import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { getToolPref, setToolPref } from '#lib/server/tools/meetings.ts';
import { formObject } from '#lib/validation/auth.ts';

/** Connected Tools for students: shortcuts only (no accounts are connected, nothing synced). */
export const load: PageServerLoad = async ({ locals, url }) => {
	const s = requireRole(locals.user, url, ['student']).id;
	return { pref: await getToolPref(locals.db, s) };
};

export const actions: Actions = {
	kahoot: async ({ locals, url, request }) => {
		const s = requireRole(locals.user, url, ['student']).id;
		const f = formObject(await request.formData());
		if (f.on !== '0' && f.on !== '1') return fail(400, { error: 'err_generic' });
		await setToolPref(locals.db, s, { kahootOn: f.on === '1' });
		return { saved: true };
	}
};
