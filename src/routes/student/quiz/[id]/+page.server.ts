import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { eq } from 'drizzle-orm';
import { questionSet, quizAssignment } from '#lib/server/db/v3.schema.ts';
import { notifyTutor } from '#lib/server/notify.ts';
import { m } from '#lib/paraglide/messages.js';
import {
	AssessFail,
	answersFromForm,
	assignmentToTake,
	submitAssignment
} from '#lib/server/assessments.ts';
import { openAttempt, submitAttempt, testAnswersFromForm, TestFail } from '#lib/server/tests.ts';

const idOf = (v: string) => (/^\d{1,9}$/.test(v) ? Number(v) : 0);

export const load: PageServerLoad = async ({ locals, url, params }) => {
	const me = requireRole(locals.user, url, ['student']).id;
	// a test built from the question bank: the student's own copy, with the timer
	const test = await openAttempt(locals.db, me, idOf(params.id));
	if (test) return { quiz: null, test };
	// only the student's own assignment; anything else looks like it doesn't exist
	const a = await assignmentToTake(locals.db, me, idOf(params.id));
	if (!a) error(404, 'Not found');
	return { quiz: a, test: null };
};

export const actions: Actions = {
	/** Hand in a test built from the bank (marked on the server, late after the timer). */
	test: async ({ locals, url, params, request }) => {
		const me = requireRole(locals.user, url, ['student']).id;
		const id = idOf(params.id);
		try {
			const r = await submitAttempt(
				locals.db,
				me,
				id,
				testAnswersFromForm(await request.formData())
			);
			const [q] = await locals.db
				.select({ tutorId: questionSet.tutorId, title: questionSet.title })
				.from(quizAssignment)
				.innerJoin(questionSet, eq(questionSet.id, quizAssignment.setId))
				.where(eq(quizAssignment.id, id));
			if (q)
				await notifyTutor(
					locals.db,
					q.tutorId,
					m.ev_quiz_done_s({ name: locals.user!.name }),
					r.toMark
						? m.qb_n_handed_b({ name: locals.user!.name, title: q.title, n: r.toMark })
						: m.ev_quiz_done_b({
								name: locals.user!.name,
								title: q.title,
								score: r.score,
								max: r.maxScore
							}),
					{ kind: 'homework', link: '/tutor/marking' }
				);
			return { handedIn: true };
		} catch (e) {
			if (e instanceof TestFail) return fail(400, { error: e.code });
			throw e;
		}
	},
	/** Hand in a hand-made quiz. */
	submit: async ({ locals, url, params, request }) => {
		const me = requireRole(locals.user, url, ['student']).id;
		const id = idOf(params.id);
		try {
			const r = await submitAssignment(
				locals.db,
				me,
				id,
				answersFromForm(await request.formData())
			);
			// the tutor who set it hears the result
			const [q] = await locals.db
				.select({ tutorId: questionSet.tutorId, title: questionSet.title })
				.from(quizAssignment)
				.innerJoin(questionSet, eq(questionSet.id, quizAssignment.setId))
				.where(eq(quizAssignment.id, id));
			if (q)
				await notifyTutor(
					locals.db,
					q.tutorId,
					m.ev_quiz_done_s({ name: locals.user!.name }),
					m.ev_quiz_done_b({
						name: locals.user!.name,
						title: q.title,
						score: r.score,
						max: r.maxScore
					}),
					{ kind: 'homework', link: `/tutor/students/${me}` }
				);
			return { marked: r };
		} catch (e) {
			if (e instanceof AssessFail) return fail(400, { error: e.code });
			throw e;
		}
	}
};
