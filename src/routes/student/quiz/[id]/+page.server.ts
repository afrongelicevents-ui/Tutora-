import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import {
	AssessFail,
	answersFromForm,
	assignmentToTake,
	submitAssignment
} from '#lib/server/assessments.ts';

const idOf = (v: string) => (/^\d{1,9}$/.test(v) ? Number(v) : 0);

export const load: PageServerLoad = async ({ locals, url, params }) => {
	const me = requireRole(locals.user, url, ['student']).id;
	// only the student's own assignment; anything else looks like it doesn't exist
	const a = await assignmentToTake(locals.db, me, idOf(params.id));
	if (!a) error(404, 'Not found');
	return { quiz: a };
};

export const actions: Actions = {
	default: async ({ locals, url, params, request }) => {
		const me = requireRole(locals.user, url, ['student']).id;
		const id = idOf(params.id);
		try {
			const r = await submitAssignment(
				locals.db,
				me,
				id,
				answersFromForm(await request.formData())
			);
			return { marked: r };
		} catch (e) {
			if (e instanceof AssessFail) return fail(400, { error: e.code });
			throw e;
		}
	}
};
