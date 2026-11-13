import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireTutor } from '#lib/server/guards.ts';
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
import { lessonsBetween } from '#lib/server/bookings.ts';
import { answersToCheck } from '#lib/server/people.ts';
import { pendingPayments } from '#lib/server/billing.ts';
import { addDays, hhmmToMinutes, local, startOfLocalDay } from '#lib/tz.ts';

/**
 * My teaching day: today's lessons, reminders (marking, payments, lesson preparation), the
 * tutor's own tasks and breaks with times (tick them off), and weekly personal goals.
 */
export const load: PageServerLoad = async ({ locals, url }) => {
	const t = requireTutor(locals.user, url).id;
	const now = new Date();
	const day = startOfLocalDay(now);
	const [mine, g, lessons, toCheck, pays] = await Promise.all([
		today(locals.db, t, now),
		goals(locals.db, t, now),
		lessonsBetween(locals.db, t, day, addDays(day, 1)),
		answersToCheck(locals.db, t),
		pendingPayments(locals.db, t)
	]);
	return {
		...mine,
		goals: g.active,
		weekday: local(now).weekday,
		lessons: lessons.map((l) => ({
			id: l.id,
			startsAt: l.startsAt,
			endsAt: l.endsAt,
			subjectName: l.subjectName,
			who: l.people.map((p) => p.name.split(' ')[0])
		})),
		toCheck: toCheck.length,
		toConfirm: pays.length
	};
};

const num = (v: FormDataEntryValue | null) => Number(v) || 0;

export const actions: Actions = {
	tick: async ({ locals, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		const f = await request.formData();
		if (!(await tickItem(locals.db, t, String(f.get('key') ?? ''), f.get('done') === '1')))
			return fail(400, { error: 'err_generic' });
		return null;
	},
	addTask: async ({ locals, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		const f = await request.formData();
		const time = String(f.get('time') ?? '').trim();
		const minute = time ? hhmmToMinutes(time) : null;
		if (time && minute === null) return fail(400, { error: 'ps_err_time', where: 'task' });
		const r = await addTask(locals.db, t, {
			title: String(f.get('title') ?? ''),
			minute,
			days: f.getAll('days').map(Number),
			onlyToday: f.get('when') !== 'repeat'
		});
		if (!r.ok) return fail(400, { error: r.error, where: 'task' });
		return { added: 'task' };
	},
	removeTask: async ({ locals, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		await removeTask(locals.db, t, num((await request.formData()).get('id')));
		return null;
	},
	addGoal: async ({ locals, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		const f = await request.formData();
		const r = await addGoal(locals.db, t, String(f.get('title') ?? ''), num(f.get('target')));
		if (!r.ok) return fail(400, { error: r.error, where: 'goal' });
		return { added: 'goal' };
	},
	removeGoal: async ({ locals, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		await removeGoal(locals.db, t, num((await request.formData()).get('id')));
		return null;
	},
	tickGoal: async ({ locals, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		const f = await request.formData();
		await tickGoal(locals.db, t, num(f.get('id')), f.get('done') === '1');
		return null;
	}
};
