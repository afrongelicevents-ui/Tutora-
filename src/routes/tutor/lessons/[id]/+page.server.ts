import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { BookingFail, cancelLesson, lessonWithPeople } from '#lib/server/bookings.ts';
import { setAttendance, setPrivateNote } from '#lib/server/people.ts';
import { requireTutor } from '#lib/server/guards.ts';
import { CLOSE_AFTER_MIN, OPEN_BEFORE_MIN } from '#lib/server/room.ts';
import { alsoTellFamily, materialShared, parentLink } from '#lib/server/events.ts';
import { notifyUser } from '#lib/server/notify.ts';
import { formObject } from '#lib/validation/auth.ts';
import { fileLink, getStore } from '#lib/server/storage.ts';
import { DOC_KINDS, MB, newKey, readUpload } from '#lib/server/files.ts';
import { hitLimit } from '#lib/server/rate-limit.ts';
import { fmtDayTime } from '#lib/tz.ts';
import { m } from '#lib/paraglide/messages.js';
import { getToolPref } from '#lib/server/tools/meetings.ts';
import {
	joinLinks,
	lessonLink,
	removeLessonLink,
	saveLessonLink
} from '#lib/server/meeting-links.ts';
import {
	addLessonMaterial,
	lessonMaterialsForTutor,
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
	const group = l.capacity > 1;
	const [materials, joins, classLink, pref] = await Promise.all([
		lessonMaterialsForTutor(locals.db, t, l.id),
		// the lesson's own meeting, else the class link, else the student's own link
		joinLinks(locals.db, [
			{ lessonId: l.id, tutorId: t, studentIds: l.people.map((p) => p.userId), group }
		]),
		group ? lessonLink(locals.db, l.id) : null,
		getToolPref(locals.db, t)
	]);
	return {
		lesson: l,
		started: l.startsAt.getTime() <= Date.now(),
		// the lesson room is open from 10 minutes before until 2 hours after the lesson
		roomOpen:
			Date.now() >= l.startsAt.getTime() - OPEN_BEFORE_MIN * 60_000 &&
			Date.now() <= l.endsAt.getTime() + CLOSE_AFTER_MIN * 60_000,
		roomClosed: url.searchParams.get('room') === 'closed',
		roomOff: url.searchParams.get('room') === 'off',
		materials: await Promise.all(
			materials.map(async (x) => ({
				...x,
				href: x.url ?? (x.fileKey ? await fileLink(x.fileKey, x.title) : null)
			}))
		),
		meeting: joins.get(l.id) ?? null,
		group,
		classLink,
		kahootOn: pref.kahootOn
	};
};

const materialFail = (e: unknown) => {
	if (e instanceof MaterialFail) return fail(400, { error: e.code });
	throw e;
};

export const actions: Actions = {
	/** one Teams / Meet / Zoom link for everybody in a group (class) lesson */
	classLink: async ({ locals, url, request, params }) => {
		const t = requireTutor(locals.user, url).id;
		const id = lessonId(params.id);
		const f = formObject(await request.formData());
		if (f.remove) {
			await removeLessonLink(locals.db, t, id);
			return { classDone: 'removed' };
		}
		const r = await saveLessonLink(locals.db, t, id, f.url ?? '');
		if (!r.ok) return fail(400, { error: r.error, classUrl: (f.url ?? '').slice(0, 500) });
		return { classDone: 'saved' };
	},
	/** Upload a small file (photo or PDF, max 5 MB) to the lesson; only this lesson's students can open it. */
	addFile: async ({ locals, url, request, params, platform }) => {
		const t = requireTutor(locals.user, url).id;
		const limit = await hitLimit(locals.db, 'upload', t);
		if (!limit.ok) return fail(429, { error: 'err_rate_limited' });
		const data = await request.formData();
		const file = await readUpload(data.get('file'), {
			maxBytes: 5 * MB,
			allowed: DOC_KINDS,
			required: true
		});
		if (!file?.ok) return fail(400, { error: file?.error ?? 'err_file_missing' });
		const key = newKey(`lessons/${lessonId(params.id)}`, file.ext);
		try {
			await addLessonMaterial(locals.db, t, lessonId(params.id), {
				kind: 'file',
				title: String(data.get('title') ?? '').trim() || m.ld3_file(),
				fileKey: key
			});
		} catch (e) {
			return materialFail(e);
		}
		await getStore(platform).put(key, file.bytes, file.kind);
		await materialShared(
			locals.db,
			t,
			lessonId(params.id),
			String(data.get('title') ?? '').trim() || m.ld3_file()
		);
		return { attached: true };
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
		await materialShared(locals.db, t, lessonId(params.id), f.title ?? '');
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
			for (const uid of r.userIds) {
				await notifyUser(
					locals.db,
					uid,
					m.email_lesson_cancel_s(),
					m.email_lesson_cancel_b({ when: fmtDayTime(r.lesson.startsAt) }),
					{ kind: 'booking', link: '/student/lessons' }
				);
				await alsoTellFamily(
					locals.db,
					uid,
					'lessons',
					m.email_lesson_cancel_s(),
					m.email_lesson_cancel_b({ when: fmtDayTime(r.lesson.startsAt) }),
					{ kind: 'family_lesson', link: parentLink('/parent', uid) }
				);
			}
		} catch (e) {
			if (e instanceof BookingFail) return fail(400, { error: e.code });
			throw e;
		}
		redirect(303, '/tutor/calendar');
	}
};
