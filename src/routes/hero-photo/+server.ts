import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { photoSrc } from '#lib/photo-slots.ts';
import { photoVersions } from '#lib/server/photos.ts';

/** The old address of the homepage photo: now Owner → Photos, slot "home". */
export const GET: RequestHandler = async ({ locals }) => {
	redirect(302, photoSrc(await photoVersions(locals.db), 'home'));
};
