import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { moderate, moderationQueue, resolveReport } from '#lib/server/buddies.ts';
import { getStore } from '#lib/server/storage.ts';
import { audit } from '#lib/server/owner.ts';

/** The owner checks student photos and bios before buddies see them, and handles reports. */
export const load: PageServerLoad = async ({ locals, url }) => {
	requireRole(locals.user, url, ['owner']);
	return moderationQueue(locals.db);
};

export const actions: Actions = {
	check: async ({ locals, url, request, platform }) => {
		const u = requireRole(locals.user, url, ['owner']);
		const f = await request.formData();
		const what = f.get('what');
		const id = String(f.get('student') ?? '');
		if ((what !== 'photo' && what !== 'bio') || !id) return fail(400, { error: 'err_generic' });
		const approve = f.get('approve') === '1';
		const removedKey = await moderate(locals.db, id, what, approve);
		if (removedKey)
			await getStore(platform)
				.delete(removedKey)
				.catch(() => {});
		await audit(locals.db, u.id, `profile_${what}_${approve ? 'approved' : 'rejected'}`, id);
		return { done: true };
	},
	resolve: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['owner']);
		const id = Number((await request.formData()).get('report'));
		await resolveReport(locals.db, u.id, id);
		await audit(locals.db, u.id, 'buddy_report_resolved', String(id));
		return { done: true };
	}
};
