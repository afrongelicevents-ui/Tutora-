import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import {
	connectByCode,
	defaultDisplayName,
	getCard,
	listBuddies,
	myCode,
	newCode,
	removeBuddy
} from '#lib/server/buddies.ts';
import { sendNotices } from '#lib/server/buddy-notify.ts';
import { hitLimit } from '#lib/server/rate-limit.ts';
import { user } from '#lib/server/db/auth.schema.ts';
import { buddyCode } from '#lib/server/db/buddies.schema.ts';
import type { DB } from '#lib/server/db/types.ts';

async function displayNameOf(db: DB, id: string) {
	const card = await getCard(db, id);
	if (card?.displayName) return card.displayName;
	const [u] = await db.select({ name: user.name }).from(user).where(eq(user.id, id));
	return defaultDisplayName(u?.name ?? '');
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const u = requireRole(locals.user, url, ['student']);
	const [code, list] = await Promise.all([myCode(locals.db, u.id), listBuddies(locals.db, u.id)]);
	return { code, ...list };
};

export const actions: Actions = {
	add: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['student']);
		if (!(await hitLimit(locals.db, 'buddyCode', u.id)).ok)
			return fail(429, { error: 'err_too_many' });
		const raw = String((await request.formData()).get('code') ?? '');
		// the other student's name, for the notifications only (looked up after the checks)
		const [c] = await locals.db
			.select({ studentId: buddyCode.studentId })
			.from(buddyCode)
			.where(eq(buddyCode.code, raw.toUpperCase().replace(/[^A-Z0-9]/g, '')));
		const r = await connectByCode(locals.db, u.id, raw, {
			me: await displayNameOf(locals.db, u.id),
			other: c ? await displayNameOf(locals.db, c.studentId) : ''
		});
		if (!r.ok) return fail(400, { error: r.error });
		await sendNotices(locals.db, r.notices);
		return { added: r.status };
	},
	newCode: async ({ locals, url }) => {
		const u = requireRole(locals.user, url, ['student']);
		await newCode(locals.db, u.id);
		return { fresh: true };
	},
	remove: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['student']);
		const id = Number((await request.formData()).get('link'));
		if (!(await removeBuddy(locals.db, u.id, id))) return fail(400, { error: 'buddy_not_allowed' });
		return { removed: true };
	}
};
