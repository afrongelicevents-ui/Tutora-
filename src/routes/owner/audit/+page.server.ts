import type { PageServerLoad } from './$types';
import { requireOwner } from '#lib/server/guards.ts';
import { auditCount, recentAudit } from '#lib/server/owner.ts';
import { pageFrom } from '#lib/server/owner-admin.ts';

/** System → Activity log: everything done in Tutora admin, in plain words, 25 a page. */
export const load: PageServerLoad = async ({ locals, url }) => {
	requireOwner(locals.user, url);
	const { page, limit, offset } = pageFrom(url);
	const [log, total] = await Promise.all([
		recentAudit(locals.db, limit, offset),
		auditCount(locals.db)
	]);
	return { log, total, page };
};
