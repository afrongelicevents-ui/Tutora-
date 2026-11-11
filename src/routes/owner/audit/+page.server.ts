import type { PageServerLoad } from './$types';
import { requireOwner } from '#lib/server/guards.ts';
import { recentAudit } from '#lib/server/owner.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	requireOwner(locals.user, url);
	return { log: await recentAudit(locals.db) };
};
