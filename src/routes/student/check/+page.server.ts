import { fail } from '@sveltejs/kit';
import { BETTER_AUTH_SECRET } from '$app/env/private';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import {
	AssessFail,
	answersFromForm,
	dailyCheck,
	submitDailyCheck
} from '#lib/server/assessments.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	const id = requireRole(locals.user, url, ['student']).id;
	return dailyCheck(locals.db, id, BETTER_AUTH_SECRET);
};

export const actions: Actions = {
	/** Marked here: the browser only sends the signed question list and the chosen answers. */
	default: async ({ locals, url, request }) => {
		const id = requireRole(locals.user, url, ['student']).id;
		const f = await request.formData();
		const token = f.get('token');
		if (typeof token !== 'string') return fail(400, { error: 'st5_err_check_old' });
		try {
			const r = await submitDailyCheck(
				locals.db,
				id,
				BETTER_AUTH_SECRET,
				token,
				answersFromForm(f)
			);
			return { marked: r };
		} catch (e) {
			if (e instanceof AssessFail) return fail(400, { error: e.code });
			throw e;
		}
	}
};
