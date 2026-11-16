import { fail } from '@sveltejs/kit';
import { and, asc, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { resourceShared } from '#lib/server/events.ts';
import { requireTutor } from '#lib/server/guards.ts';
import { subject } from '#lib/server/db/app.schema.ts';
import { getToolPref } from '#lib/server/tools/meetings.ts';
import { ownStudents } from '#lib/server/tools/kahoot-import.ts';
import {
	addResource,
	MaterialFail,
	removeResource,
	resourcesForTutor
} from '#lib/server/materials.ts';
import { formObject } from '#lib/validation/auth.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	const t = requireTutor(locals.user, url).id;
	const [resources, students, subjects, pref] = await Promise.all([
		resourcesForTutor(locals.db, t),
		ownStudents(locals.db, t),
		locals.db
			.select({ name: subject.name })
			.from(subject)
			.where(and(eq(subject.tutorId, t), eq(subject.active, true)))
			.orderBy(asc(subject.sortOrder)),
		getToolPref(locals.db, t)
	]);
	return {
		resources,
		students,
		subjects: [...new Set(subjects.map((s: { name: string }) => s.name))],
		kahootOn: pref.kahootOn
	};
};

const failed = (e: unknown) => {
	if (e instanceof MaterialFail) return fail(400, { error: e.code });
	throw e;
};

export const actions: Actions = {
	addLink: async ({ locals, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		const f = formObject(await request.formData());
		try {
			await addResource(locals.db, t, {
				subject: f.subject ?? '',
				level: f.level,
				studentId: f.studentId || null,
				kind: f.kind === 'kahoot' ? 'kahoot' : 'link',
				title: f.title ?? '',
				url: f.url
			});
		} catch (e) {
			return failed(e);
		}
		await resourceShared(locals.db, t, f.studentId || null, f.subject ?? '', f.title ?? '');
		return { added: true };
	},
	remove: async ({ locals, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		const id = Number(formObject(await request.formData()).id);
		if (!Number.isInteger(id) || id <= 0 || !(await removeResource(locals.db, t, id)))
			return fail(404, { error: 'err_not_found' });
		return { removed: true };
	}
};
