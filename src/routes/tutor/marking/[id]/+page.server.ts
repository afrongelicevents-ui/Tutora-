import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireTutor } from '#lib/server/guards.ts';
import { attemptForTutor, marksFromForm, saveMarks, TestFail, totals } from '#lib/server/tests.ts';
import { notifyUser } from '#lib/server/notify.ts';
import { m } from '#lib/paraglide/messages.js';

const idOf = (v: string) => (/^\d{1,9}$/.test(v) ? Number(v) : 0);

/** One handed-in test on the tutor's own test: every answer, marks to give or change. */
export const load: PageServerLoad = async ({ locals, url, params }) => {
	const t = requireTutor(locals.user, url).id;
	const r = await attemptForTutor(locals.db, t, idOf(params.id));
	if (!r || !r.att.submittedAt) error(404, 'Not found');
	return {
		name: r.name,
		title: r.set.title,
		setId: r.set.id,
		submittedAt: r.att.submittedAt,
		late: r.att.late,
		autoClosed: r.att.autoClosed,
		needsMarking: r.att.needsMarking,
		items: r.att.items,
		...totals(r.att.items)
	};
};

export const actions: Actions = {
	default: async ({ locals, url, params, request }) => {
		const tutor = requireTutor(locals.user, url);
		try {
			const r = await saveMarks(
				locals.db,
				tutor.id,
				idOf(params.id),
				marksFromForm(await request.formData())
			);
			if (!r.toMark)
				await notifyUser(
					locals.db,
					r.studentId,
					m.qb_n_marked_s({ name: tutor.name.split(' ')[0] }),
					m.qb_n_marked_b({ title: r.title, score: r.score, max: r.maxScore }),
					{ kind: 'homework', link: `/student/quiz/${r.assignmentId}` }
				);
			return { done: r.toMark ? 'marks_saved' : 'marked' };
		} catch (e) {
			if (e instanceof TestFail) return fail(400, { error: e.code });
			throw e;
		}
	}
};
