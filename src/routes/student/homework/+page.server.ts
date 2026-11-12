import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getHomework, handIn, homeworkForUser } from '#lib/server/people.ts';
import { requireRole } from '#lib/server/guards.ts';
import { fileLink, getStore } from '#lib/server/storage.ts';
import { DOC_KINDS, MB, newKey, readUpload } from '#lib/server/files.ts';
import { hitLimit } from '#lib/server/rate-limit.ts';
import { notifyTutor } from '#lib/server/notify.ts';
import { formObject } from '#lib/validation/auth.ts';
import { and, asc, eq, inArray, isNull, or } from 'drizzle-orm';
import { homeworkLink, resource } from '#lib/server/db/v3.schema.ts';
import { enrollment, homework } from '#lib/server/db/app.schema.ts';
import type { DB } from '#lib/server/db/types.ts';
import { connections } from '#lib/server/tools/oauth.ts';
import { pickerConfig, shareFile, verifyPickedFile } from '#lib/server/tools/drive.ts';
import { toolsEnv } from '#lib/server/tools/env.ts';
import { addAnswerLink, MaterialFail } from '#lib/server/materials.ts';
import { user } from '#lib/server/db/auth.schema.ts';

/** Revision resources from this student's own tutors (for everyone, or just for them). */
async function revisionResources(db: DB, studentId: string) {
	const tutors = await db
		.select({ id: enrollment.tutorId })
		.from(enrollment)
		.where(eq(enrollment.userId, studentId));
	if (!tutors.length) return [];
	return db
		.select({
			id: resource.id,
			subject: resource.subject,
			level: resource.level,
			kind: resource.kind,
			title: resource.title,
			url: resource.url
		})
		.from(resource)
		.where(
			and(
				inArray(
					resource.tutorId,
					tutors.map((t) => t.id)
				),
				or(isNull(resource.studentId), eq(resource.studentId, studentId))
			)
		)
		.orderBy(asc(resource.subject), asc(resource.id));
}

/** Drive files and links attached to this student's homework. */
function homeworkLinks(db: DB, studentId: string) {
	return db
		.select({
			id: homeworkLink.id,
			homeworkId: homeworkLink.homeworkId,
			kind: homeworkLink.kind,
			title: homeworkLink.title,
			url: homeworkLink.url
		})
		.from(homeworkLink)
		.innerJoin(homework, eq(homework.id, homeworkLink.homeworkId))
		.where(eq(homework.userId, studentId));
}
import { m } from '#lib/paraglide/messages.js';

export const load: PageServerLoad = async ({ locals, url }) => {
	const u = requireRole(locals.user, url, ['student']);
	const [items, resources, links] = await Promise.all([
		homeworkForUser(locals.db, u.id),
		revisionResources(locals.db, u.id),
		homeworkLinks(locals.db, u.id)
	]);
	const link = (k: string | null, n: string | null) => (k ? fileLink(k, n ?? 'file') : null);
	return {
		resources,
		picker: pickerConfig(toolsEnv(url), (await connections(locals.db, u.id)).drive),
		items: await Promise.all(
			items.map(async (h) => ({
				...h,
				links: links.filter((l) => l.homeworkId === h.id),
				fileUrl: await link(h.fileKey, h.fileName),
				answers: await Promise.all(
					h.answers.map(async (a) => ({ ...a, fileUrl: await link(a.fileKey, a.fileName) }))
				)
			}))
		)
	};
};

export const actions: Actions = {
	/** Hand in a file picked from Google Drive (only files the student picks; drive.file). */
	attachDrive: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['student']);
		const f = formObject(await request.formData());
		const h = await getHomework(locals.db, Number(f.id) || 0);
		if (!h || h.userId !== u.id) return fail(404, { error: 'err_not_found', id: f.id });
		const env = toolsEnv(url);
		const file = await verifyPickedFile(locals.db, env, u.id, f.fileId ?? '');
		if (!file) return fail(400, { error: 'tools6_drive_failed', id: f.id });
		const answer = await handIn(locals.db, u.id, h.id, {
			note: null,
			fileKey: null,
			fileName: null
		});
		if (!answer) return fail(404, { error: 'err_not_found', id: f.id });
		try {
			await addAnswerLink(locals.db, u.id, answer.id, {
				kind: 'drive',
				title: file.name,
				url: file.url,
				driveFileId: file.id
			});
		} catch (e) {
			if (e instanceof MaterialFail) return fail(400, { error: e.code, id: f.id });
			throw e;
		}
		const [t] = await locals.db
			.select({ email: user.email })
			.from(user)
			.where(eq(user.id, h.tutorId));
		await shareFile(locals.db, env, u.id, file.id, t?.email);
		await notifyTutor(locals.db, h.tutorId, m.email_hw_in_s(), m.email_hw_in_b({ name: u.name }));
		return { done: true };
	},
	handIn: async ({ locals, url, request, platform }) => {
		const u = requireRole(locals.user, url, ['student']);
		const limit = await hitLimit(locals.db, 'upload', u.id);
		if (!limit.ok)
			return fail(429, {
				error: 'err_rate_limited',
				minutes: Math.ceil(limit.retryAfterSeconds / 60)
			});
		const data = await request.formData();
		const f = formObject(data);
		const file = await readUpload(data.get('file'), { maxBytes: 5 * MB, allowed: DOC_KINDS });
		if (file && !file.ok) return fail(400, { error: file.error, id: f.id });
		const note = f.note?.trim().slice(0, 2000) || null;
		if (!file && !note) return fail(400, { error: 'err_answer_empty', id: f.id });
		let fileKey: string | null = null;
		if (file?.ok) {
			fileKey = newKey(`answers/${u.id}`, file.ext);
			await getStore(platform).put(fileKey, file.bytes, file.kind);
		}
		const row = await handIn(locals.db, u.id, Number(f.id) || 0, {
			note,
			fileKey,
			fileName: file?.ok ? file.name : null
		});
		if (!row) return fail(404, { error: 'err_not_found' });
		const h = await getHomework(locals.db, row.homeworkId);
		if (h)
			await notifyTutor(locals.db, h.tutorId, m.email_hw_in_s(), m.email_hw_in_b({ name: u.name }));
		return { done: true };
	}
};
