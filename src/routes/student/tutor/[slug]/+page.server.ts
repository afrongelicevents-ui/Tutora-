import { error, fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { activeTutorBySlug, publicSite, type PublicSite } from '#lib/server/settings.ts';
import { favourite } from '#lib/server/db/app.schema.ts';
import { requireRole } from '#lib/server/guards.ts';

/** A tutor's profile inside the app (approved tutors only). */
export const load: PageServerLoad = async ({ locals, url, params }) => {
	const u = requireRole(locals.user, url, ['student']);
	const s = await activeTutorBySlug(locals.db, params.slug);
	if (!s) error(404, 'Not found');
	const [site, [fav]] = await Promise.all([
		publicSite(locals.db, s),
		locals.db
			.select()
			.from(favourite)
			.where(and(eq(favourite.userId, u.id), eq(favourite.tutorId, s.tutorId)))
	]);
	const { tutorId: _id, whatsapp: _w, phone: _p, email: _e, ...pub } = site as PublicSite;
	return { site: pub, saved: !!fav };
};

export const actions: Actions = {
	save: async ({ locals, url, params, request }) => {
		const u = requireRole(locals.user, url, ['student']);
		const s = await activeTutorBySlug(locals.db, params.slug);
		if (!s) return fail(404, {});
		const on = (await request.formData()).get('on') === '1';
		if (on)
			await locals.db
				.insert(favourite)
				.values({ userId: u.id, tutorId: s.tutorId })
				.onConflictDoNothing();
		else
			await locals.db
				.delete(favourite)
				.where(and(eq(favourite.userId, u.id), eq(favourite.tutorId, s.tutorId)));
		return null;
	}
};
