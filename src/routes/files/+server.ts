import { error } from '@sveltejs/kit';
import { BETTER_AUTH_SECRET } from '$app/env/private';
import type { RequestHandler } from './$types';
import { verifySignedUrl } from '#lib/server/files.ts';
import { getStore } from '#lib/server/storage.ts';

/**
 * Opens a private file through a signed link that expires after 10 minutes.
 * Links are only created after checking who may see the file.
 */
export const GET: RequestHandler = async ({ url, platform }) => {
	const ok = await verifySignedUrl(BETTER_AUTH_SECRET, url.searchParams);
	if (!ok) error(403, 'This link has expired. Go back and open it again.');
	const f = await getStore(platform).get(ok.key);
	if (!f) error(404, 'Not found');
	const safe = ok.name.replace(/[^\w.-]/g, '_');
	const inline = /^(image\/(jpeg|png|webp)|application\/pdf)$/.test(f.contentType);
	return new Response(f.body as BodyInit, {
		headers: {
			'content-type': f.contentType,
			'content-disposition': `${inline ? 'inline' : 'attachment'}; filename="${safe}"`,
			'cache-control': 'private, max-age=600',
			'x-content-type-options': 'nosniff',
			// even if a file were hostile, it can't run scripts or reach our cookies
			'content-security-policy':
				"default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
			'referrer-policy': 'no-referrer'
		}
	});
};
