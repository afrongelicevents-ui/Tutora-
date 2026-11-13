import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireOwner } from '#lib/server/guards.ts';
import { notifyUser } from '#lib/server/notify.ts';
import { m } from '#lib/paraglide/messages.js';
import { moderate, moderationQueue, resolveReport } from '#lib/server/buddies.ts';
import { getStore } from '#lib/server/storage.ts';
import { audit } from '#lib/server/owner.ts';

/** The owner checks student photos and bios before buddies see them, and handles reports. */
export const load: PageServerLoad = async ({ locals, url }) => {
	requireOwner(locals.user, url);
	return moderationQueue(locals.db);
};

export const actions: Actions = {
	check: async ({ locals, url, request, platform }) => {
		const u = requireOwner(locals.user, url);
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
		// the student hears the result of the check
		const thing = what === 'photo' ? m.ev_thing_photo() : m.ev_thing_bio();
		await notifyUser(
			locals.db,
			id,
			approve ? m.ev_checked_ok_s({ thing }) : m.ev_checked_no_s({ thing }),
			approve ? m.ev_checked_ok_b({ thing }) : m.ev_checked_no_b({ thing }),
			{ kind: 'family', link: '/student/me/edit' }
		);
		return { done: true };
	},
	resolve: async ({ locals, url, request }) => {
		const u = requireOwner(locals.user, url);
		const id = Number((await request.formData()).get('report'));
		await resolveReport(locals.db, u.id, id);
		await audit(locals.db, u.id, 'buddy_report_resolved', String(id));
		return { done: true };
	}
};
