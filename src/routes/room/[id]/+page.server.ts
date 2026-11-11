import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireUser } from '#lib/server/guards.ts';
import { addRoomFile, enter, isAdmitted, roomAccess } from '#lib/server/room.ts';
import { lessonWithPeople } from '#lib/server/bookings.ts';
import { iceServers } from '#lib/server/ice.ts';
import { getStore } from '#lib/server/storage.ts';
import { DOC_KINDS, MB, newKey, readUpload } from '#lib/server/files.ts';
import { hitLimit } from '#lib/server/rate-limit.ts';

export const load: PageServerLoad = async ({ locals, url, params, fetch }) => {
	const u = requireUser(locals.user, url);
	const id = Number(params.id) || 0;
	const access = await roomAccess(locals.db, u, id);
	if (!access)
		error(404, 'This lesson room is not open. Rooms open 30 minutes before an online lesson.');
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
