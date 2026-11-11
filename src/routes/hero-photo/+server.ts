import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getContent } from '#lib/server/content.ts';
import { getStore } from '#lib/server/storage.ts';

/** The homepage photo chosen by the owner. ?v= changes with every new photo: cached for a year. */
export const GET: RequestHandler = async ({ locals, platform }) => {
	const c = await getContent(locals.db);
	if (!c.heroPhoto) error(404, 'Not found');
	const f = await getStore(platform).get(c.heroPhoto);
	if (!f) error(404, 'Not found');
	return new Response(f.body as BodyInit, {
		headers: {
			'content-type': f.contentType,
			'cache-control': 'public, max-age=31536000, immutable',
			'x-content-type-options': 'nosniff'
		}
	});
};
