import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { isId, loadThread, sendAction } from '#lib/server/message-actions.ts';

export const load: PageServerLoad = async ({ locals, url, params }) => {
	const u = requireRole(locals.user, url, ['tutor']);
	if (!isId(params.studentId)) error(404, 'Not found');
	const t = await loadThread(locals.db, u, { tutorId: u.id, studentId: params.studentId });
	return { ...t, meId: u.id, otherName: t.names[params.studentId] ?? '' };
};

export const actions: Actions = {
	send: async ({ locals, url, params, request }) => {
		const u = requireRole(locals.user, url, ['tutor']);
		return sendAction(
			locals.db,
			u,
			{ tutorId: u.id, studentId: params.studentId },
			await request.formData(),
			() => `/student/messages/${u.id}`
		);
	}
};
