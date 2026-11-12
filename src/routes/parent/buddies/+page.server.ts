import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { pickChild } from '#lib/server/parent-child.ts';
import { parentBuddyList, parentDecide, removeBuddy } from '#lib/server/buddies.ts';
import { sendNotices } from '#lib/server/buddy-notify.ts';

/** Family Connection: a parent sees their child's buddies, approves (under 13) and removes. */
export const load: PageServerLoad = async ({ locals, url, cookies }) => {
	const u = requireRole(locals.user, url, ['parent']);
	const { kids, current } = await pickChild(locals.db, u.id, url, cookies);
	const list = current ? await parentBuddyList(locals.db, u.id, current) : null;
	return { kids, current, list: list ?? [] };
};

export const actions: Actions = {
	decide: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['parent']);
		const f = await request.formData();
		const r = await parentDecide(locals.db, u.id, Number(f.get('link')), f.get('approve') === '1');
		if (!r.ok) return fail(400, { error: 'buddy_not_allowed' });
		await sendNotices(locals.db, r.notices);
		return { done: true };
	},
	remove: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['parent']);
		const ok = await removeBuddy(locals.db, u.id, Number((await request.formData()).get('link')));
		if (!ok) return fail(400, { error: 'buddy_not_allowed' });
		return { removed: true };
	}
};
