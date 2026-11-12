import type { PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { pickChild } from '#lib/server/parent-child.ts';
import { childConversations } from '#lib/server/messages.ts';

/** Family Connection: read-only view of an under-18 child's messages with their tutors. */
export const load: PageServerLoad = async ({ locals, url, cookies }) => {
	const u = requireRole(locals.user, url, ['parent']);
	const { kids, current } = await pickChild(locals.db, u.id, url, cookies);
	const convs = current ? await childConversations(locals.db, u.id, current) : null;
	return { kids, current, convs, allowed: convs !== null };
};
