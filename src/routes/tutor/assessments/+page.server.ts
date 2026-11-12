import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireTutor } from '#lib/server/guards.ts';
import { AssessFail, createSet, listSets, resultsForTutor } from '#lib/server/assessments.ts';
import { setFromForm } from './form.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	const t = requireTutor(locals.user, url).id;
	const [sets, results] = await Promise.all([
		listSets(locals.db, t),
		resultsForTutor(locals.db, t, 20)
	]);
	return { sets, results };
};

export const actions: Actions = {
	create: async ({ locals, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		let id: number;
		try {
			id = (await createSet(locals.db, t, setFromForm(await request.formData()))).id;
		} catch (e) {
			if (e instanceof AssessFail) return fail(400, { error: e.code });
			throw e;
		}
		redirect(303, `/tutor/assessments/${id}`);
	}
};
