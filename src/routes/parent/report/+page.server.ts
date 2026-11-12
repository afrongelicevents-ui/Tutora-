import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { weeklyReport } from '#lib/server/parent.ts';
import { pickChild } from '#lib/server/parent-child.ts';
import { addDays, fromLocal, isIsoDate, startOfLocalWeek } from '#lib/tz.ts';

/** The weekly report: last week by default (?week=YYYY-MM-DD for a Monday). */
export const load: PageServerLoad = async ({ locals, url, cookies }) => {
	const u = requireRole(locals.user, url, ['parent']);
	const { kids, current } = await pickChild(locals.db, u.id, url, cookies);
	const w = url.searchParams.get('week') ?? '';
	const weekStart = isIsoDate(w)
		? startOfLocalWeek(fromLocal(w, 720))
		: addDays(startOfLocalWeek(new Date()), -7);
	if (!current) return { kids, current, report: null, prev: null, next: null };
	const report = await weeklyReport(locals.db, u.id, current, weekStart);
	if (!report) error(404, 'Not found');
	const iso = (d: Date) => d.toISOString().slice(0, 10);
	const nextStart = addDays(weekStart, 7);
	return {
		kids,
		current,
		report,
		prev: iso(addDays(weekStart, -7 + 0.5)),
		next: nextStart <= new Date() ? iso(addDays(nextStart, 0.5)) : null
	};
};
