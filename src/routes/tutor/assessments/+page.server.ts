import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireTutor } from '#lib/server/guards.ts';
import {
	AssessFail,
	createSet,
	enrolledStudents,
	listSets,
	resultsForTutor
} from '#lib/server/assessments.ts';
import {
	closeExpired,
	countBank,
	enterOutsideScore,
	TestFail,
	toMarkCount
} from '#lib/server/tests.ts';
import { proAccess } from '#lib/server/pro.ts';
import { localDate } from '#lib/tz.ts';
import { setFromForm } from './form.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	const t = requireTutor(locals.user, url).id;
	await closeExpired(locals.db, t);
	const [sets, results, toMark, bank, students, pro] = await Promise.all([
		listSets(locals.db, t),
		resultsForTutor(locals.db, t, 20),
		toMarkCount(locals.db, t),
		countBank(locals.db, t),
		enrolledStudents(locals.db, t),
		proAccess(locals.db, t)
	]);
	return { sets, results, toMark, bank, students, pro: pro.active, today: localDate(new Date()) };
};

const text = (f: FormData, k: string) => {
	const v = f.get(k);
	return typeof v === 'string' ? v : '';
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
	},
	/** A score from Google Forms, Kahoot! or a paper test. */
	score: async ({ locals, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		const f = await request.formData();
		try {
			await enterOutsideScore(locals.db, t, {
				studentId: text(f, 'studentId'),
				source: text(f, 'source'),
				title: text(f, 'title'),
				subject: text(f, 'subject'),
				chapter: text(f, 'chapter'),
				term: text(f, 'term') || null,
				score: Number(text(f, 'score')),
				maxScore: Number(text(f, 'maxScore')),
				takenOn: text(f, 'takenOn') || null
			});
		} catch (e) {
			if (e instanceof TestFail) return fail(400, { error: e.code, form: 'score' });
			throw e;
		}
		return { done: 'score' };
	}
};
