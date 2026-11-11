import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { activeTutorBySlug, tutorBySlug } from '#lib/server/settings.ts';
import { getStore } from '#lib/server/storage.ts';

/** A tutor's public photo. The ?v= number changes on every new photo, so it can be cached for a year. */
export const GET: RequestHandler = async ({ locals, platform, params }) => {
	const s =
		(await activeTutorBySlug(locals.db, params.slug)) ??
		(locals.user?.role === 'owner' ? await tutorBySlug(locals.db, params.slug) : null);
	if (!s?.photoKey) error(404, 'Not found');
	const f = await getStore(platform).get(s.photoKey);
	if (!f) error(404, 'Not found');
	return new Response(f.body as BodyInit, {
		headers: {
			'content-type': f.contentType,
			'cache-control': 'public, max-age=31536000, immutable',
			'x-content-type-options': 'nosniff'
		}
	});
};
