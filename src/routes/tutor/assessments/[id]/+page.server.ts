import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireTutor } from '#lib/server/guards.ts';
import {
	AssessFail,
	addQuestion,
	assignSet,
	assignmentsForSet,
	deleteSet,
	enrolledStudents,
	getSet,
	removeQuestion,
	unassign,
	updateQuestion,
	updateSet
} from '#lib/server/assessments.ts';
import { notifyUser } from '#lib/server/notify.ts';
import { fmtDate, fromLocal, isIsoDate, localDate } from '#lib/tz.ts';
import { m } from '#lib/paraglide/messages.js';
import { questionFromForm, setFromForm } from '../form.ts';

const idOf = (v: unknown) => (typeof v === 'string' && /^\d{1,9}$/.test(v) ? Number(v) : 0);

export const load: PageServerLoad = async ({ locals, url, params }) => {
	const t = requireTutor(locals.user, url).id;
	const id = idOf(params.id);
	const own = await getSet(locals.db, t, id);
	if (!own) error(404, 'Not found');
	const [assigned, students] = await Promise.all([
		assignmentsForSet(locals.db, t, id),
		enrolledStudents(locals.db, t)
	]);
	return { ...own, assigned, students, today: localDate(new Date()) };
};

/** Runs a change and turns AssessFail into a form error for the named form. */
async function attempt(formName: string, fn: () => Promise<unknown>) {
	try {
		await fn();
		return null;
	} catch (e) {
		if (e instanceof AssessFail) return fail(400, { error: e.code, form: formName });
		throw e;
	}
}

export const actions: Actions = {
	save: async ({ locals, url, params, request }) => {
		const t = requireTutor(locals.user, url).id;
		const f = await request.formData();
		return (
			(await attempt('set', () => updateSet(locals.db, t, idOf(params.id), setFromForm(f)))) ?? {
				done: 'saved'
			}
		);
	},

	delete: async ({ locals, url, params }) => {
		const t = requireTutor(locals.user, url).id;
		await deleteSet(locals.db, t, idOf(params.id));
		redirect(303, '/tutor/assessments');
	},

	addQuestion: async ({ locals, url, params, request }) => {
		const t = requireTutor(locals.user, url).id;
		const f = await request.formData();
		return (
			(await attempt('new', () =>
				addQuestion(locals.db, t, idOf(params.id), questionFromForm(f))
			)) ?? {
				done: 'question_added'
			}
		);
	},

	editQuestion: async ({ locals, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		const f = await request.formData();
		const q = idOf(f.get('id'));
		return (
			(await attempt(`q${q}`, () => updateQuestion(locals.db, t, q, questionFromForm(f)))) ?? {
				done: 'question_saved'
			}
		);
	},

	removeQuestion: async ({ locals, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		await removeQuestion(locals.db, t, idOf((await request.formData()).get('id')));
		return { done: 'question_removed' };
	},

	/** To one of MY enrolled students only (checked in assignSet). */
	assign: async ({ locals, url, params, request }) => {
		const tutor = requireTutor(locals.user, url);
		const f = await request.formData();
		const studentId = String(f.get('studentId') ?? '');
		const dueOn = String(f.get('dueOn') ?? '');
		if (dueOn && !isIsoDate(dueOn)) return fail(400, { error: 'st5_err_date', form: 'assign' });
		let r: Awaited<ReturnType<typeof assignSet>>;
		try {
			r = await assignSet(locals.db, tutor.id, idOf(params.id), studentId, dueOn || null);
		} catch (e) {
			if (e instanceof AssessFail) return fail(400, { error: e.code, form: 'assign' });
			throw e;
		}
		await notifyUser(
			locals.db,
			studentId,
			(r.set.kind === 'test' ? m.st5_n_test_s : m.st5_n_quiz_s)({ name: tutor.name.split(' ')[0] }),
			dueOn
				? m.st5_n_quiz_due_b({ title: r.set.title, date: fmtDate(fromLocal(dueOn)) })
				: m.st5_n_quiz_b({ title: r.set.title }),
			{ kind: 'homework', link: `/student/quiz/${r.assignment.id}` }
		);
		return { done: 'assigned' };
	},

	unassign: async ({ locals, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		await unassign(locals.db, t, idOf((await request.formData()).get('id')));
		return { done: 'unassigned' };
	}
};
