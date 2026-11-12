import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { isId, loadThread, sendAction } from '#lib/server/message-actions.ts';

export const load: PageServerLoad = async ({ locals, url, params }) => {
	const u = requireRole(locals.user, url, ['student']);
	if (!isId(params.tutorId)) error(404, 'Not found');
	const t = await loadThread(locals.db, u, { tutorId: params.tutorId, studentId: u.id });
	return { ...t, meId: u.id, otherName: t.names[params.tutorId] ?? '' };
};

export const actions: Actions = {
	send: async ({ locals, url, params, request }) => {
		const u = requireRole(locals.user, url, ['student']);
		return sendAction(
			locals.db,
			u,
			{ tutorId: params.tutorId, studentId: u.id },
			await request.formData(),
			() => `/tutor/messages/${u.id}`
		);
	}
};
