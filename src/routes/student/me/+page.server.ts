import type { PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { listBuddies, ownProfile } from '#lib/server/buddies.ts';
import { familyOf } from '#lib/server/family.ts';

/** The student's own profile: real data only; private fields are shown to them alone. */
export const load: PageServerLoad = async ({ locals, url }) => {
	const u = requireRole(locals.user, url, ['student']);
	const now = new Date();
	const [p, buddies, family] = await Promise.all([
		ownProfile(locals.db, u.id, now),
		listBuddies(locals.db, u.id, now),
		familyOf(locals.db, u.id)
	]);
	return {
		id: u.id,
		profile: p,
		buddies: buddies.active.slice(0, 6).map((b) => ({
			id: b.id,
			displayName: b.displayName,
			photoVersion: b.photoVersion,
			streak: b.streak
		})),
		buddyCount: buddies.active.length,
		pendingCount: buddies.pending.length,
		familyCount: family.filter((f) => f.status === 'active').length
	};
};
