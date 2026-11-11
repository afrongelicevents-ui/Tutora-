import type { PageServerLoad } from './$types';
import { requireOwner } from '#lib/server/guards.ts';
import { allBookings } from '#lib/server/owner.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	requireOwner(locals.user, url);
	const status = url.searchParams.get('status') ?? '';
	return { status, bookings: await allBookings(locals.db, status) };
};
