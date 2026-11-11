import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { lessonsBetween } from '#lib/server/bookings.ts';
import { addEvent, eventsBetween, removeEvent } from '#lib/server/calendar.ts';
import { requireTutor } from '#lib/server/guards.ts';
import { formObject } from '#lib/validation/auth.ts';
import {
	addDays,
	addMinutes,
	fromLocal,
	hhmmToMinutes,
	isIsoDate,
	localDate,
	startOfLocalDay,
	startOfLocalWeek
} from '#lib/tz.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	const t = requireTutor(locals.user, url).id;
	const view = url.searchParams.get('view') === 'day' ? 'day' : 'week';
	const d = url.searchParams.get('date') ?? '';
	const anchor = isIsoDate(d) ? fromLocal(d, 12 * 60) : new Date();
	const from = view === 'week' ? startOfLocalWeek(anchor) : startOfLocalDay(anchor);
	const to = addDays(from, view === 'week' ? 7 : 1);
	const [lessons, events] = await Promise.all([
		lessonsBetween(locals.db, t, from, to),
		eventsBetween(locals.db, t, from, to)
	]);
	return {
		view,
		from,
		days: Array.from({ length: view === 'week' ? 7 : 1 }, (_, i) => localDate(addDays(from, i))),
		today: localDate(new Date()),
		prev: localDate(addDays(from, view === 'week' ? -7 : -1)),
		next: localDate(addDays(from, view === 'week' ? 7 : 1)),
		lessons,
		events
	};
};

const eventSchema = z.object({
	title: z.string().trim().min(1, 'err_required').max(80, 'err_too_long'),
	date: z.string().refine(isIsoDate, 'err_times'),
	time: z.string().refine((v) => hhmmToMinutes(v) !== null, 'err_times'),
	minutes: z.coerce
		.number()
		.int()
		.min(15)
		.max(24 * 60)
		.default(60),
	note: z.string().trim().max(300).optional()
});

export const actions: Actions = {
	addEvent: async ({ locals, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		const p = eventSchema.safeParse(formObject(await request.formData()));
		if (!p.success) return fail(400, { error: 'err_times' });
		const startsAt = fromLocal(p.data.date, hhmmToMinutes(p.data.time)!);
		await addEvent(locals.db, t, {
			title: p.data.title,
			startsAt,
			endsAt: addMinutes(startsAt, p.data.minutes),
			note: p.data.note || null
		});
		return { added: true };
	},
	removeEvent: async ({ locals, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		const id = Number(formObject(await request.formData()).id);
		if (Number.isInteger(id)) await removeEvent(locals.db, t, id);
		return { removed: true };
	}
};
