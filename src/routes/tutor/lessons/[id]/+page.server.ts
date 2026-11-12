import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { BookingFail, cancelLesson, lessonWithPeople } from '#lib/server/bookings.ts';
import { setAttendance, setPrivateNote } from '#lib/server/people.ts';
import { requireTutor } from '#lib/server/guards.ts';
import { notifyUser } from '#lib/server/notify.ts';
import { formObject } from '#lib/validation/auth.ts';
import { fmtDayTime } from '#lib/tz.ts';
import { m } from '#lib/paraglide/messages.js';
import { toolsEnv } from '#lib/server/tools/env.ts';
import { connections } from '#lib/server/tools/oauth.ts';
import { cancelMeetingForLesson, getToolPref, meetingFor } from '#lib/server/tools/meetings.ts';
import { pickerConfig, shareWithAll, verifyPickedFile } from '#lib/server/tools/drive.ts';
import {
	addLessonMaterial,
	lessonMaterialsForTutor,
	lessonStudentEmails,
	MaterialFail,
	removeLessonMaterial
} from '#lib/server/materials.ts';

const lessonId = (p: string) => {
	const n = Number(p);
	if (!Number.isInteger(n) || n <= 0) error(404, 'Not found');
	return n;
};

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const t = requireTutor(locals.user, url).id;
	const l = await lessonWithPeople(locals.db, lessonId(params.id), t);
	if (!l) error(404, 'Not found');
	const [materials, meeting, conn, pref] = await Promise.all([
		lessonMaterialsForTutor(locals.db, t, l.id),
		meetingFor(locals.db, l.id),
		connections(locals.db, t),
		getToolPref(locals.db, t)
	]);
	return {
		lesson: l,
		started: l.startsAt.getTime() <= Date.now(),
		materials,
		meeting,
		kahootOn: pref.kahootOn,
		picker: pickerConfig(toolsEnv(url), conn.drive)
	};
};

const materialFail = (e: unknown) => {
	if (e instanceof MaterialFail) return fail(400, { error: e.code });
	throw e;
};

export const actions: Actions = {
	/** a file picked with the Google Picker: checked with the tutor's Drive, then shared */
	attachDrive: async ({ locals, url, request, params }) => {
		const t = requireTutor(locals.user, url).id;
		const id = lessonId(params.id);
		const f = formObject(await request.formData());
		const env = toolsEnv(url);
		const file = await verifyPickedFile(locals.db, env, t, f.fileId ?? '');
		if (!file) return fail(400, { error: 'tools6_err_drive_file' });
		try {
			await addLessonMaterial(locals.db, t, id, {
				kind: 'drive',
				title: file.name,
				url: file.url,
				driveFileId: file.id
			});
		} catch (e) {
			return materialFail(e);
		}
		const emails = await lessonStudentEmails(locals.db, t, id);
		const share = emails.length
			? await shareWithAll(locals.db, env, t, file.id, emails)
			: ('skipped' as const);
		return { attached: true, share };
	},
	addLink: async ({ locals, url, request, params }) => {
		const t = requireTutor(locals.user, url).id;
		const f = formObject(await request.formData());
		const kind = f.kind === 'kahoot' ? 'kahoot' : 'link';
		try {
			await addLessonMaterial(locals.db, t, lessonId(params.id), {
				kind,
				title: f.title ?? '',
				url: f.url
			});
		} catch (e) {
			return materialFail(e);
		}
		return { attached: true };
	},
	removeMaterial: async ({ locals, url, request, params }) => {
		const t = requireTutor(locals.user, url).id;
		const f = formObject(await request.formData());
		const mid = Number(f.id);
		if (!Number.isInteger(mid) || mid <= 0) return fail(404, { error: 'err_not_found' });
		const ok = await removeLessonMaterial(locals.db, t, lessonId(params.id), mid);
		if (!ok) return fail(404, { error: 'err_not_found' });
		return { removed: true };
	},
	note: async ({ locals, url, request, params }) => {
		const t = requireTutor(locals.user, url).id;
		const f = formObject(await request.formData());
		const l = await lessonWithPeople(locals.db, lessonId(params.id), t);
		const a = l?.people.find((p) => p.attendeeId === Number(f.attendeeId));
		if (!a) return fail(404, { error: 'err_not_found' });
		await setPrivateNote(locals.db, t, a.attendeeId, f.note?.trim().slice(0, 2000) || null);
		return { saved: true };
	},
	attendance: async ({ locals, url, request, params }) => {
		const t = requireTutor(locals.user, url).id;
		const f = formObject(await request.formData());
		const l = await lessonWithPeople(locals.db, lessonId(params.id), t);
		const a = l?.people.find((p) => p.attendeeId === Number(f.attendeeId));
		if (!l || !a) return fail(404, { error: 'err_not_found' });
		if (l.startsAt.getTime() > Date.now()) return fail(400, { error: 'err_not_started' });
		if (l.endsAt.getTime() < Date.now() - 7 * 86_400_000)
			return fail(400, { error: 'err_too_late_mark' });
		const v = f.value === 'completed' || f.value === 'absent' ? f.value : null;
		await setAttendance(locals.db, t, a.attendeeId, v);
		// the student is told when they are marked absent
		if (v === 'absent' && a.attendance !== 'absent')
			await notifyUser(
				locals.db,
				a.userId,
				m.absent_s(),
				m.absent_b({ when: fmtDayTime(l.startsAt) }),
				{
					kind: 'lesson',
					link: `/student/lessons/${l.id}`
				}
			);
		return { saved: true };
	},
	cancel: async ({ locals, url, request, params }) => {
		const t = requireTutor(locals.user, url).id;
		const f = formObject(await request.formData());
		if (f.sure !== 'on') return fail(400, { error: 'err_tick_sure' });
		try {
			const r = await cancelLesson(locals.db, t, lessonId(params.id));
			// remove the Meet event / Teams meeting too (best effort, never blocks)
			await cancelMeetingForLesson(locals.db, toolsEnv(url), r.lesson.id);
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
