import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { addActivity, isKind, removeActivity, tipsFor, weekBlocks } from '#lib/server/schedule.ts';
import { hhmmToMinutes, local } from '#lib/tz.ts';

/** The personal timetable, one weekday at a time, with tips that keep it sensible. */
export const load: PageServerLoad = async ({ locals, url }) => {
	const u = requireRole(locals.user, url, ['student']);
	const week = await weekBlocks(locals.db, u.id);
	const asked = Number(url.searchParams.get('day'));
	const day =
		Number.isInteger(asked) && asked >= 0 && asked <= 6 && url.searchParams.has('day')
			? asked
			: local(new Date()).weekday;
	return { day, blocks: week[day], tips: tipsFor(week[day]), counts: week.map((d) => d.length) };
};

export const actions: Actions = {
	add: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['student']);
		const f = await request.formData();
		const kind = f.get('kind');
		const start = hhmmToMinutes(String(f.get('start') ?? ''));
		const end = hhmmToMinutes(String(f.get('end') ?? ''));
		if (!isKind(kind) || kind === 'study') return fail(400, { error: 'err_generic' });
		if (start === null || end === null) return fail(400, { error: 'ps_err_time' });
		const r = await addActivity(locals.db, u.id, {
			kind,
			label: String(f.get('label') ?? ''),
			days: f.getAll('days').map(Number),
			start,
			end
		});
		if (!r.ok) return fail(400, { error: r.error });
		return { added: true };
	},
	remove: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['student']);
		await removeActivity(locals.db, u.id, Number((await request.formData()).get('id')) || 0);
		return { removed: true };
	}
};
