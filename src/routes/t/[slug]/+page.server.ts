import { fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { activeTutorBySlug } from '#lib/server/settings.ts';
import { favourite } from '#lib/server/db/app.schema.ts';
import { requireRole } from '#lib/server/guards.ts';

const isStudent = (role?: string) => role === 'student' || role === 'parent';

/** Students and parents can save a tutor to their favourites. */
export const load: PageServerLoad = async ({ locals, params }) => {
	const u = locals.user;
	if (!u || !isStudent(u.role)) return { canSave: false, saved: false };
	const s = await activeTutorBySlug(locals.db, params.slug);
	if (!s) return { canSave: false, saved: false };
	const [f] = await locals.db
		.select()
		.from(favourite)
		.where(and(eq(favourite.userId, u.id), eq(favourite.tutorId, s.tutorId)));
	return { canSave: true, saved: !!f };
};

export const actions: Actions = {
	save: async ({ locals, url, params }) => {
		const u = requireRole(locals.user, url, ['student', 'parent']);
		const s = await activeTutorBySlug(locals.db, params.slug);
		if (!s) return fail(404, {});
		await locals.db
			.insert(favourite)
			.values({ userId: u.id, tutorId: s.tutorId })
			.onConflictDoNothing();
		return { saved: true };
	},
	unsave: async ({ locals, url, params }) => {
		const u = requireRole(locals.user, url, ['student', 'parent']);
		const s = await activeTutorBySlug(locals.db, params.slug);
		if (!s) return fail(404, {});
		await locals.db
			.delete(favourite)
			.where(and(eq(favourite.userId, u.id), eq(favourite.tutorId, s.tutorId)));
		return { saved: false };
	}
};
