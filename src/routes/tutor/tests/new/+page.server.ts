import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireTutor } from '#lib/server/guards.ts';
import { AssessFail, assignSet, enrolledStudents } from '#lib/server/assessments.ts';
import { bankTags, buildTest, TestFail } from '#lib/server/tests.ts';
import { buildFromForm } from '#lib/server/tests-form.ts';
import { notifyUser } from '#lib/server/notify.ts';
import { fmtDate, fromLocal, isIsoDate, localDate } from '#lib/tz.ts';
import { m } from '#lib/paraglide/messages.js';

/** The test builder: choose subject, form, chapters and how many; Tutora picks and shuffles. */
export const load: PageServerLoad = async ({ locals, url }) => {
	const t = requireTutor(locals.user, url).id;
	const [tags, students] = await Promise.all([
		bankTags(locals.db, t),
		enrolledStudents(locals.db, t)
	]);
	return { tags, students, today: localDate(new Date()) };
};

export const actions: Actions = {
	default: async ({ locals, url, request }) => {
		const tutor = requireTutor(locals.user, url);
		const v = buildFromForm(await request.formData());
		if (v.dueOn && !isIsoDate(v.dueOn)) return fail(400, { error: 'st5_err_date', n: null });
		let setId: number;
		try {
			const set = await buildTest(locals.db, tutor.id, v);
			setId = set.id;
			for (const studentId of [...new Set(v.studentIds)].slice(0, 60)) {
				const r = await assignSet(locals.db, tutor.id, set.id, studentId, v.dueOn || null);
				await notifyUser(
					locals.db,
					studentId,
					m.st5_n_test_s({ name: tutor.name.split(' ')[0] }),
					v.dueOn
						? m.st5_n_quiz_due_b({ title: set.title, date: fmtDate(fromLocal(v.dueOn)) })
						: m.st5_n_quiz_b({ title: set.title }),
					{ kind: 'homework', link: `/student/quiz/${r.assignment.id}` }
				);
			}
		} catch (e) {
			if (e instanceof TestFail) return fail(400, { error: e.code, n: e.n ?? null });
			if (e instanceof AssessFail) return fail(400, { error: e.code, n: null });
			throw e;
		}
		redirect(303, `/tutor/assessments/${setId}`);
	}
};
