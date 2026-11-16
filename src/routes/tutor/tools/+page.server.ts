import type { Actions, PageServerLoad } from './$types';
import { requireTutor } from '#lib/server/guards.ts';
import { getToolPref, setToolPref } from '#lib/server/tools/meetings.ts';
import { formObject } from '#lib/validation/auth.ts';

/** Connected Tools: shortcuts to Teams, Meet, Zoom, Drive and Kahoot! (nothing is synced). */
export const load: PageServerLoad = async ({ locals, url }) => {
	const t = requireTutor(locals.user, url).id;
	return { pref: await getToolPref(locals.db, t) };
};

export const actions: Actions = {
	/** Kahoot! quiz links on lessons and revision (a setting, not a connection) */
	kahoot: async ({ locals, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		const f = formObject(await request.formData());
		await setToolPref(locals.db, t, { kahootOn: f.on === '1' });
		return { saved: true };
	}
};
