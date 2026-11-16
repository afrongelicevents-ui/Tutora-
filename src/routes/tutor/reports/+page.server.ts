import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireTutor } from '#lib/server/guards.ts';
import { listStudents } from '#lib/server/people.ts';
import {
	createReport,
	deleteReport,
	lastMonth,
	ReportFail,
	reportsByTutor,
	sendReport,
	updateReport
} from '#lib/server/reports.ts';
import { formObject } from '#lib/validation/auth.ts';

/** Reports: built from lessons, homework, check-ins and tests, plus the tutor's note. */
export const load: PageServerLoad = async ({ locals, url }) => {
	const t = requireTutor(locals.user, url).id;
	const student = url.searchParams.get('student') ?? '';
	const [students, reports] = await Promise.all([
		listStudents(locals.db, t),
		reportsByTutor(locals.db, t)
	]);
	return {
		students: students.map((s) => ({ id: s.id, name: s.name })),
		reports,
		period: lastMonth(),
		student: students.some((s) => s.id === student) ? student : ''
	};
};

const handle = async <T>(fn: () => Promise<T>) => {
	try {
		return await fn();
	} catch (e) {
		if (e instanceof ReportFail) return fail(400, { error: e.code });
		throw e;
	}
};

export const actions: Actions = {
	create: async ({ locals, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		const f = formObject(await request.formData());
		return handle(async () => {
			const r = await createReport(
				locals.db,
				t,
				f.studentId ?? '',
				{ from: f.from ?? '', to: f.to ?? '' },
				f.note,
				new Date(),
				f.noteVisible === 'student'
			);
			return { created: r.id };
		});
	},
	save: async ({ locals, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		const f = formObject(await request.formData());
		return handle(async () => {
			await updateReport(
				locals.db,
				t,
				Number(f.id) || 0,
				f.note,
				new Date(),
				f.noteVisible === 'student'
			);
			return { saved: true };
		});
	},
	send: async ({ locals, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		const f = formObject(await request.formData());
		return handle(async () => {
			const id = Number(f.id) || 0;
			// the note as written in the box, then send
			if (f.note !== undefined)
				await updateReport(locals.db, t, id, f.note, new Date(), f.noteVisible === 'student');
			await sendReport(locals.db, t, id);
			return { sent: true };
		});
	},
	remove: async ({ locals, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		const f = formObject(await request.formData());
		if (!(await deleteReport(locals.db, t, Number(f.id) || 0)))
			return fail(404, { error: 'err_not_found' });
		return { removed: true };
	}
};
