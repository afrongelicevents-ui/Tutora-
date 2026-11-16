import type { PageServerLoad } from './$types';
import { requireOwner } from '#lib/server/guards.ts';
import { pageFrom, partnershipList } from '#lib/server/owner-admin.ts';

/** School+: every partnership by status (the owner looks; the family and tutors decide). */
export const load: PageServerLoad = async ({ locals, url }) => {
	requireOwner(locals.user, url);
	const status = url.searchParams.get('status') ?? '';
	const { page, limit, offset } = pageFrom(url);
	const r = await partnershipList(locals.db, { status, limit, offset });
	return { status, page, rows: r.rows, counts: r.counts, total: r.total };
};
