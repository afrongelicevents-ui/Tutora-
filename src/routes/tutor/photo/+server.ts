import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireTutor } from '#lib/server/guards.ts';
import { getSettings } from '#lib/server/settings.ts';
import { getStore } from '#lib/server/storage.ts';

/** The logged-in tutor's own photo (for Settings, also before their page is public). */
export const GET: RequestHandler = async ({ locals, platform, url }) => {
	const t = requireTutor(locals.user, url).id;
	const s = await getSettings(locals.db, t);
	if (!s.photoKey) error(404, 'Not found');
	const f = await getStore(platform).get(s.photoKey);
	if (!f) error(404, 'Not found');
	return new Response(f.body as BodyInit, {
		headers: {
			'content-type': f.contentType,
			'cache-control': 'private, max-age=3600',
			'x-content-type-options': 'nosniff'
		}
	});
};
