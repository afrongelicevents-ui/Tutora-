import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import {
	addGoal,
	addTask,
	goals,
	removeGoal,
	removeTask,
	tickGoal,
	tickItem,
	today
} from '#lib/server/planner.ts';
import { hhmmToMinutes, local } from '#lib/tz.ts';

/** The daily personal planner: today's plan with ticks, personal tasks, weekly goals. */
export const load: PageServerLoad = async ({ locals, url }) => {
	const u = requireRole(locals.user, url, ['student']);
	const now = new Date();
	const [t, g] = await Promise.all([today(locals.db, u.id, now), goals(locals.db, u.id, now)]);
	return { ...t, goals: g.active, weekday: local(now).weekday };
};

const num = (v: FormDataEntryValue | null) => Number(v) || 0;

export const actions: Actions = {
	tick: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['student']);
		const f = await request.formData();
		const ok = await tickItem(locals.db, u.id, String(f.get('key') ?? ''), f.get('done') === '1');
		if (!ok) return fail(400, { error: 'err_generic' });
		return null;
	},
	addTask: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['student']);
		const f = await request.formData();
		const time = String(f.get('time') ?? '').trim();
		const minute = time ? hhmmToMinutes(time) : null;
		if (time && minute === null) return fail(400, { error: 'ps_err_time' });
		const r = await addTask(locals.db, u.id, {
			title: String(f.get('title') ?? ''),
			minute,
			days: f.getAll('days').map(Number),
			onlyToday: f.get('when') !== 'repeat'
		});
		if (!r.ok) return fail(400, { error: r.error, where: 'task' });
		return { added: 'task' };
	},
	removeTask: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['student']);
		await removeTask(locals.db, u.id, num((await request.formData()).get('id')));
		return null;
	},
	addGoal: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['student']);
		const f = await request.formData();
		const r = await addGoal(locals.db, u.id, String(f.get('title') ?? ''), num(f.get('target')));
		if (!r.ok) return fail(400, { error: r.error, where: 'goal' });
		return { added: 'goal' };
	},
	removeGoal: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['student']);
		await removeGoal(locals.db, u.id, num((await request.formData()).get('id')));
		return null;
	},
	tickGoal: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['student']);
		const f = await request.formData();
		await tickGoal(locals.db, u.id, num(f.get('id')), f.get('done') === '1');
		return null;
	}
};
