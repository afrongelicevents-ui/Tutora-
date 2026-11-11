import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { BookingFail, cancelLesson, lessonWithPeople } from '#lib/server/bookings.ts';
import { setPrivateNote } from '#lib/server/people.ts';
import { requireTutor } from '#lib/server/guards.ts';
import { notifyUser } from '#lib/server/notify.ts';
import { formObject } from '#lib/validation/auth.ts';
import { fmtDayTime } from '#lib/tz.ts';
import { m } from '#lib/paraglide/messages.js';

const lessonId = (p: string) => {
	const n = Number(p);
	if (!Number.isInteger(n) || n <= 0) error(404, 'Not found');
	return n;
};

export const load: PageServerLoad = async ({ locals, params, url }) => {
	requireTutor(locals.user, url);
	const l = await lessonWithPeople(locals.db, lessonId(params.id));
	if (!l) error(404, 'Not found');
	return { lesson: l };
};

export const actions: Actions = {
	note: async ({ locals, url, request, params }) => {
		requireTutor(locals.user, url);
		const f = formObject(await request.formData());
		const l = await lessonWithPeople(locals.db, lessonId(params.id));
		const a = l?.people.find((p) => p.attendeeId === Number(f.attendeeId));
		if (!a) return fail(404, { error: 'err_not_found' });
		await setPrivateNote(locals.db, a.attendeeId, f.note?.trim().slice(0, 2000) || null);
		return { saved: true };
	},
	cancel: async ({ locals, url, request, params }) => {
		requireTutor(locals.user, url);
		const f = formObject(await request.formData());
		if (f.sure !== 'on') return fail(400, { error: 'err_tick_sure' });
		try {
			const r = await cancelLesson(locals.db, lessonId(params.id));
			for (const uid of r.userIds) {
				await notifyUser(
					locals.db,
					uid,
					m.email_lesson_cancel_s(),
					m.email_lesson_cancel_b({ when: fmtDayTime(r.lesson.startsAt) })
				);
			}
		} catch (e) {
			if (e instanceof BookingFail) return fail(400, { error: e.code });
			throw e;
		}
		redirect(303, '/tutor/calendar');
	}
};
