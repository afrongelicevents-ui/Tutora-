import type { PageServerLoad } from './$types';
import { requireTutor } from '#lib/server/guards.ts';
import { proAccess } from '#lib/server/pro.ts';
import { studentInsights } from '#lib/server/pro-earnings.ts';

/** Pro: student insights: who is falling behind, and attendance patterns (last 8 weeks). */
export const load: PageServerLoad = async ({ locals, url }) => {
	const t = requireTutor(locals.user, url).id;
	const pro = await proAccess(locals.db, t);
	return {
		pro: pro.active,
		students: pro.active ? await studentInsights(locals.db, t) : []
	};
};
