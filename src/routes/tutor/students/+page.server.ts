import type { PageServerLoad } from './$types';
import { listStudents } from '#lib/server/people.ts';
import { balances } from '#lib/server/billing.ts';
import { getSettings } from '#lib/server/settings.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	const q = (url.searchParams.get('q') ?? '').slice(0, 60);
	const [students, bal, s] = await Promise.all([
		listStudents(locals.db, q),
		balances(locals.db),
		getSettings(locals.db)
	]);
	return {
		q,
		currency: s.currency,
		students: students.map((x) => ({ ...x, owed: bal.get(x.id)?.owed ?? 0 }))
	};
};
