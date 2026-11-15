import type { PageServerLoad } from './$types';
import { desc, eq } from 'drizzle-orm';
import { requireOwner } from '#lib/server/guards.ts';
import { usageSnapshot } from '#lib/server/db/usage.schema.ts';
import { LIMITS, meters, type Usage } from '#lib/server/free-limits.ts';

/** Owner → Free limits: the latest hourly reading for the live and the test site. */
export const load: PageServerLoad = async ({ locals, url }) => {
	requireOwner(locals.user, url);
	const latest = async (site: 'live' | 'test') => {
		const [row] = await locals.db
			.select({ data: usageSnapshot.data, takenAt: usageSnapshot.takenAt })
			.from(usageSnapshot)
			.where(eq(usageSnapshot.site, site))
			.orderBy(desc(usageSnapshot.takenAt))
			.limit(1);
		if (!row) return null;
		const u = row.data as Usage;
		return { at: row.takenAt, usage: u, meters: meters(u) };
	};
	const [live, test] = await Promise.all([latest('live'), latest('test')]);
	return { live, test, limits: LIMITS };
};
