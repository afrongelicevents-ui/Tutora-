import { requireTutor } from '#lib/server/guards.ts';
import type { PageServerLoad } from './$types';
import { listStudents } from '#lib/server/people.ts';
import { balances } from '#lib/server/billing.ts';
import { getSettings } from '#lib/server/settings.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	const t = requireTutor(locals.user, url).id;
	const q = (url.searchParams.get('q') ?? '').slice(0, 60);
	const [students, bal, s] = await Promise.all([
		listStudents(locals.db, t, q),
		balances(locals.db, t),
		getSettings(locals.db, t)
	]);
	return {
		q,
		currency: s.currency,
		students: students.map((x) => ({ ...x, owed: bal.get(x.id)?.owed ?? 0 }))
	};
};
