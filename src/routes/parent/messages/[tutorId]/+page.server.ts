import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { isId, loadThread } from '#lib/server/message-actions.ts';

export const load: PageServerLoad = async ({ locals, url, params }) => {
	const u = requireRole(locals.user, url, ['parent']);
	const child = url.searchParams.get('child') ?? '';
	if (!isId(params.tutorId) || !isId(child)) error(404, 'Not found');
	// loadThread checks this parent may read this child's messages (404 otherwise)
	const t = await loadThread(locals.db, u, { tutorId: params.tutorId, studentId: child });
	return { ...t, meId: '', child, otherName: t.names[params.tutorId] ?? '' };
};
