import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { handIn, homeworkForUser } from '#lib/server/people.ts';
import { requireRole } from '#lib/server/guards.ts';
import { fileLink, getStore } from '#lib/server/storage.ts';
import { DOC_KINDS, MB, newKey, readUpload } from '#lib/server/files.ts';
import { hitLimit } from '#lib/server/rate-limit.ts';
import { notifyTutor } from '#lib/server/notify.ts';
import { formObject } from '#lib/validation/auth.ts';
import { m } from '#lib/paraglide/messages.js';

export const load: PageServerLoad = async ({ locals, url }) => {
	requireRole(locals.user, url, ['student', 'parent']);
	const items = await homeworkForUser(locals.db, locals.user!.id);
	const link = (k: string | null, n: string | null) => (k ? fileLink(k, n ?? 'file') : null);
	return {
		items: await Promise.all(
			items.map(async (h) => ({
				...h,
				fileUrl: await link(h.fileKey, h.fileName),
				answers: await Promise.all(
					h.answers.map(async (a) => ({ ...a, fileUrl: await link(a.fileKey, a.fileName) }))
				)
			}))
		)
	};
};

export const actions: Actions = {
	handIn: async ({ locals, url, request, platform }) => {
		const u = requireRole(locals.user, url, ['student', 'parent']);
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
		await notifyTutor(locals.db, m.email_hw_in_s(), m.email_hw_in_b({ name: u.name }));
		return { done: true };
	}
};
