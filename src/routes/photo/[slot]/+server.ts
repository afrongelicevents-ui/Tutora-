import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isPhotoSlot } from '#lib/photo-slots.ts';
import { photoFor } from '#lib/server/photos.ts';
import { getStore } from '#lib/server/storage.ts';

/** The owner's photo for one place on the site. ?v= changes with every new photo: cached for a year. */
export const GET: RequestHandler = async ({ locals, platform, params }) => {
	if (!isPhotoSlot(params.slot)) error(404, 'Not found');
	const p = await photoFor(locals.db, params.slot);
	if (!p) error(404, 'Not found');
	const f = await getStore(platform).get(p.storageKey);
	if (!f) error(404, 'Not found');
	return new Response(f.body as BodyInit, {
		headers: {
			'content-type': f.contentType,
			'cache-control': 'public, max-age=31536000, immutable',
			'x-content-type-options': 'nosniff'
		}
	});
};
