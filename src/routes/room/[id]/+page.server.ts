import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireUser } from '#lib/server/guards.ts';
import {
	addRoomFile,
	CLOSE_AFTER_MIN,
	enter,
	isAdmitted,
	OPEN_BEFORE_MIN,
	roomAccess
} from '#lib/server/room.ts';
import { m } from '#lib/paraglide/messages.js';
import { lessonWithPeople } from '#lib/server/bookings.ts';
import { iceServers } from '#lib/server/ice.ts';
import { getStore } from '#lib/server/storage.ts';
import { DOC_KINDS, MB, newKey, readUpload } from '#lib/server/files.ts';
import { hitLimit } from '#lib/server/rate-limit.ts';

export const load: PageServerLoad = async ({ locals, url, params, fetch }) => {
	const u = requireUser(locals.user, url);
	const id = Number(params.id) || 0;
	const access = await roomAccess(locals.db, u, id);
	if (!access) {
		// someone's own lesson outside the open window: back to the lesson, with an honest note
		const own = await lessonWithPeople(locals.db, id);
		if (own && u.role === 'tutor' && own.tutorId === u.id)
			redirect(303, `/tutor/lessons/${id}?room=closed`);
		if (own && u.role === 'student' && own.people.some((p) => p.userId === u.id))
			redirect(303, `/student/lessons/${id}`);
		error(404, m.room_not_open({ before: OPEN_BEFORE_MIN, after: CLOSE_AFTER_MIN }));
	}
	await enter(locals.db, access, u.id);
	const l = await lessonWithPeople(locals.db, id);
	return {
		lessonId: id,
		me: { id: u.id, name: u.name.split(/\s+/)[0], isTutor: access.role === 'tutor' },
		title: l?.subjectName ?? null,
		startsAt: access.lesson.startsAt,
		endsAt: access.lesson.endsAt,
		ice: await iceServers(fetch),
		group: access.lesson.capacity > 1
	};
};

export const actions: Actions = {
	file: async ({ locals, url, params, request, platform }) => {
		const u = requireUser(locals.user, url);
		const id = Number(params.id) || 0;
		const access = await roomAccess(locals.db, u, id);
		if (!access || !(await isAdmitted(locals.db, id, u.id)))
			return fail(404, { error: 'err_not_found' });
		const limit = await hitLimit(locals.db, 'upload', u.id);
		if (!limit.ok) return fail(429, { error: 'err_rate_limited' });
		const file = await readUpload((await request.formData()).get('file'), {
			maxBytes: 5 * MB,
			allowed: DOC_KINDS,
			required: true
		});
		if (!file?.ok) return fail(400, { error: file?.error ?? 'err_file_missing' });
		const key = newKey(`room/${id}`, file.ext);
		await getStore(platform).put(key, file.bytes, file.kind);
		await addRoomFile(locals.db, { lessonId: id, userId: u.id, fileKey: key, fileName: file.name });
		return { shared: true };
	}
};
