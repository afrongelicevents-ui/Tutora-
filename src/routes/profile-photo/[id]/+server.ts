import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { canSeePhoto, getCard } from '#lib/server/buddies.ts';
import { getStore } from '#lib/server/storage.ts';

/**
 * A student's profile photo. Only the student, their parents, the owner, and active buddies
 * (once the photo has been checked) can load it. Never cached by shared caches.
 */
export const GET: RequestHandler = async ({ locals, platform, params }) => {
	const viewer = locals.user ? { id: locals.user.id, role: locals.user.role } : undefined;
	if (!(await canSeePhoto(locals.db, viewer, params.id))) error(404, 'Not found');
	const card = await getCard(locals.db, params.id);
	if (!card?.photoKey) error(404, 'Not found');
	const f = await getStore(platform).get(card.photoKey);
	if (!f) error(404, 'Not found');
	return new Response(f.body as BodyInit, {
		headers: {
			'content-type': f.contentType,
			'cache-control': 'private, max-age=86400',
			'x-content-type-options': 'nosniff'
		}
	});
};
