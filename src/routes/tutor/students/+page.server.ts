import { requireTutor } from '#lib/server/guards.ts';
import type { PageServerLoad } from './$types';
import { getSettings } from '#lib/server/settings.ts';
import { studentCards, studentStats } from '#lib/server/tutor-students.ts';

/** My students: stats, search, status filter, one card per student, insights. */
export const load: PageServerLoad = async ({ locals, url }) => {
	const t = requireTutor(locals.user, url).id;
	const q = (url.searchParams.get('q') ?? '').slice(0, 60);
	const f = url.searchParams.get('status');
	const status = f === 'active' || f === 'inactive' || f === 'pending' ? f : '';
	const [{ cards, insights }, stats, s] = await Promise.all([
		studentCards(locals.db, t, q),
		studentStats(locals.db, t),
		getSettings(locals.db, t)
	]);
	return {
		q,
		status,
		currency: s.currency,
		total: cards.length,
		counts: {
			active: cards.filter((c) => c.status === 'active').length,
			inactive: cards.filter((c) => c.status === 'inactive').length,
			pending: cards.filter((c) => c.status === 'pending').length
		},
		stats,
		insights,
		students: status ? cards.filter((c) => c.status === status) : cards
	};
};
