import { fail } from '@sveltejs/kit';
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { requireTutor } from '#lib/server/guards.ts';
import { subject } from '#lib/server/db/app.schema.ts';
import { user } from '#lib/server/db/auth.schema.ts';
import { toolsEnv } from '#lib/server/tools/env.ts';
import { connections } from '#lib/server/tools/oauth.ts';
import { getToolPref } from '#lib/server/tools/meetings.ts';
import { pickerConfig, shareWithAll, verifyPickedFile } from '#lib/server/tools/drive.ts';
import { ownStudents } from '#lib/server/tools/kahoot-import.ts';
import {
	addResource,
	MaterialFail,
	removeResource,
	resourcesForTutor
} from '#lib/server/materials.ts';
import { formObject } from '#lib/validation/auth.ts';
import type { DB } from '#lib/server/db/types.ts';

/** Share at most this many students on one "all students" file (the rest: share yourself). */
const MAX_SHARE = 60;

async function emailsFor(db: DB, tutorId: string, studentId: string | null) {
	if (studentId) {
		const [u] = await db.select({ email: user.email }).from(user).where(eq(user.id, studentId));
		return u ? [u.email] : [];
	}
	const ids = (await ownStudents(db, tutorId)).map((s) => s.id).slice(0, MAX_SHARE);
	if (!ids.length) return [];
	const rows = await db.select({ email: user.email }).from(user).where(inArray(user.id, ids));
	return rows.map((r) => r.email);
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const t = requireTutor(locals.user, url).id;
	const [resources, students, subjects, conn, pref] = await Promise.all([
		resourcesForTutor(locals.db, t),
		ownStudents(locals.db, t),
		locals.db
			.select({ name: subject.name })
			.from(subject)
			.where(and(eq(subject.tutorId, t), eq(subject.active, true)))
			.orderBy(asc(subject.sortOrder)),
		connections(locals.db, t),
		getToolPref(locals.db, t)
	]);
	return {
		resources,
		students,
		subjects: [...new Set(subjects.map((s: { name: string }) => s.name))],
		kahootOn: pref.kahootOn,
		picker: pickerConfig(toolsEnv(url), conn.drive)
	};
};

const failed = (e: unknown) => {
	if (e instanceof MaterialFail) return fail(400, { error: e.code });
	throw e;
};

export const actions: Actions = {
	attachDrive: async ({ locals, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		const f = formObject(await request.formData());
		const env = toolsEnv(url);
		const file = await verifyPickedFile(locals.db, env, t, f.fileId ?? '');
		if (!file) return fail(400, { error: 'tools6_err_drive_file' });
		const studentId = f.studentId || null;
		try {
			await addResource(locals.db, t, {
				subject: f.subject ?? '',
				level: f.level,
				studentId,
				kind: 'drive',
				title: file.name,
				url: file.url,
				driveFileId: file.id
			});
		} catch (e) {
			return failed(e);
		}
		const emails = await emailsFor(locals.db, t, studentId);
		const share = emails.length
			? await shareWithAll(locals.db, env, t, file.id, emails)
			: 'skipped';
		return { added: true, share };
	},
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
