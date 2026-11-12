import { error, fail, redirect } from '@sveltejs/kit';
import { and, eq, or } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import {
	blockStudent,
	buddyView,
	isPreset,
	messagesBetween,
	PRESETS,
	removeBuddy,
	reportStudent,
	sendPreset
} from '#lib/server/buddies.ts';
import { tellOwners } from '#lib/server/buddy-notify.ts';
import { buddyLink } from '#lib/server/db/buddies.schema.ts';

/** A buddy's profile: only the buddy whitelist, read-only, with Report and Block. */
export const load: PageServerLoad = async ({ locals, url, params }) => {
	const u = requireRole(locals.user, url, ['student']);
	const view = await buddyView(locals.db, u.id, params.id);
	// not a buddy (or blocked): the same "not found" whatever the reason
	if (!view) error(404, 'Not found');
	const messages = await messagesBetween(locals.db, u.id, params.id);
	return { view, messages, presets: PRESETS };
};

export const actions: Actions = {
	send: async ({ locals, url, params, request }) => {
		const u = requireRole(locals.user, url, ['student']);
		const preset = (await request.formData()).get('preset');
		if (!isPreset(preset)) return fail(400, { error: 'buddy_not_allowed' });
		const r = await sendPreset(locals.db, u.id, params.id, preset);
		if (!r.ok) return fail(400, { error: r.error });
		return { sent: true };
	},
	report: async ({ locals, url, params, request }) => {
		const u = requireRole(locals.user, url, ['student']);
		const f = await request.formData();
		const what = String(f.get('what'));
		if (!['photo', 'bio', 'behaviour', 'other'].includes(what))
			return fail(400, { error: 'buddy_not_allowed' });
		const ok = await reportStudent(
			locals.db,
			u.id,
			params.id,
			what as 'photo' | 'bio' | 'behaviour' | 'other',
			String(f.get('note') ?? '')
		);
		if (!ok) return fail(400, { error: 'buddy_not_allowed' });
		await tellOwners(locals.db);
		return { reported: true };
	},
	block: async ({ locals, url, params }) => {
		const u = requireRole(locals.user, url, ['student']);
		await blockStudent(locals.db, u.id, params.id);
		redirect(303, '/student/buddies');
	},
	remove: async ({ locals, url, params }) => {
		const u = requireRole(locals.user, url, ['student']);
		const [l] = await locals.db
			.select({ id: buddyLink.id })
			.from(buddyLink)
			.where(
				or(
					and(eq(buddyLink.aId, u.id), eq(buddyLink.bId, params.id)),
					and(eq(buddyLink.aId, params.id), eq(buddyLink.bId, u.id))
				)
			);
		if (l) await removeBuddy(locals.db, u.id, l.id);
		redirect(303, '/student/buddies');
	}
};
