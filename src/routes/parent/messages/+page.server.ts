import type { PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { pickChild } from '#lib/server/parent-child.ts';
import { childConversations } from '#lib/server/messages.ts';
import { profile } from '#lib/server/db/app.schema.ts';
import { eq } from 'drizzle-orm';

/** Family Connection: read-only view of an under-18 child's messages with their tutors. */
export const load: PageServerLoad = async ({ locals, url, cookies }) => {
	const u = requireRole(locals.user, url, ['parent']);
	const { kids, current } = await pickChild(locals.db, u.id, url, cookies);
	const convs = current ? await childConversations(locals.db, u.id, current) : null;
	// why there is nothing to read: an adult child's messages stay private; otherwise only
	// the guardian reads them
	let reason: 'adult' | 'guardian' | null = null;
	if (current && convs === null) {
		const [p] = await locals.db
			.select({ u18: profile.isUnder18 })
			.from(profile)
			.where(eq(profile.userId, current));
		reason = p?.u18 ? 'guardian' : 'adult';
	}
	return { kids, current, convs, allowed: convs !== null, reason };
};
