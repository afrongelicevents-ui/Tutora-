import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { requireTutor } from '#lib/server/guards.ts';
import { answersToCheck, checkAnswer, giveHomework, listStudents } from '#lib/server/people.ts';
import { fileLink, getStore } from '#lib/server/storage.ts';
import { DOC_KINDS, MB, newKey, readUpload } from '#lib/server/files.ts';
import { notifyUser } from '#lib/server/notify.ts';
import { formObject } from '#lib/validation/auth.ts';
import { isIsoDate } from '#lib/tz.ts';
import { m } from '#lib/paraglide/messages.js';

export const load: PageServerLoad = async ({ locals, url }) => {
	const t = requireTutor(locals.user, url).id;
	const [students, answers] = await Promise.all([
		listStudents(locals.db, t),
		answersToCheck(locals.db, t)
	]);
	return {
		students: students.map((s) => ({ id: s.id, name: s.name, childName: s.childName })),
		answers: await Promise.all(
			answers.map(async (a) => ({
				...a,
				fileUrl: a.fileKey ? await fileLink(a.fileKey, a.fileName ?? 'answer') : null
			}))
		)
	};
};

const schema = z.object({
	title: z.string().trim().min(2, 'err_required').max(120, 'err_too_long'),
	note: z.string().trim().max(2000, 'err_too_long').optional(),
	dueOn: z
		.string()
		.optional()
		.refine((v) => !v || isIsoDate(v), 'err_times')
});

export const actions: Actions = {
	/** One homework to one or several of MY students (a group). */
	send: async ({ locals, url, request, platform }) => {
		const t = requireTutor(locals.user, url).id;
		const data = await request.formData();
		const p = schema.safeParse(formObject(data));
		if (!p.success) return fail(400, { error: p.error.issues[0].message });
		const mine = new Set((await listStudents(locals.db, t)).map((s) => s.id));
		const to = data
			.getAll('to')
			.map(String)
			.filter((id) => mine.has(id));
		if (!to.length) return fail(400, { error: 'err_pick_students' });
		const file = await readUpload(data.get('file'), { maxBytes: 5 * MB, allowed: DOC_KINDS });
		if (file && !file.ok) return fail(400, { error: file.error });
		let fileKey: string | null = null;
		if (file?.ok) {
			fileKey = newKey(`homework/${t}`, file.ext);
			await getStore(platform).put(fileKey, file.bytes, file.kind);
		}
		for (const userId of to) {
			await giveHomework(locals.db, t, {
				userId,
				title: p.data.title,
				note: p.data.note || null,
				dueOn: p.data.dueOn || null,
				fileKey,
				fileName: file?.ok ? file.name : null
			});
			await notifyUser(
				locals.db,
				userId,
				m.email_hw_new_s(),
				m.email_hw_new_b({ title: p.data.title }),
				{
					kind: 'homework',
					link: '/student/homework'
				}
			);
		}
		return { sent: to.length };
	},
	check: async ({ locals, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		const f = formObject(await request.formData());
		const ok = await checkAnswer(
			locals.db,
			t,
			Number(f.id) || 0,
			f.comment?.trim().slice(0, 1000) || null
		);
		if (!ok) return fail(404, { error: 'err_not_found' });
		return { checked: true };
	}
};
