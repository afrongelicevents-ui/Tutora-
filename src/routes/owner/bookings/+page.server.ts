import type { PageServerLoad } from './$types';
import { requireOwner } from '#lib/server/guards.ts';
import { bookingList, pageFrom, searchFrom } from '#lib/server/owner-admin.ts';

/** Learning → Bookings and lessons: every booking, to look into problems (read only). */
export const load: PageServerLoad = async ({ locals, url }) => {
	requireOwner(locals.user, url);
	const status = url.searchParams.get('status') ?? '';
	const w = url.searchParams.get('when') ?? '';
	const when = w === 'upcoming' || w === 'past' ? w : '';
	const q = searchFrom(url);
	const { page, limit, offset } = pageFrom(url);
	const r = await bookingList(locals.db, { status, q, when, limit, offset });
	return { status, when, q, page, bookings: r.rows, counts: r.counts, total: r.total };
};
