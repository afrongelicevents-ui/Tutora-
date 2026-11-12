import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { lessonsBetween, pendingRequests } from '#lib/server/bookings.ts';
import { listAvailability } from '#lib/server/settings.ts';
import { addEvent, eventsBetween, removeEvent } from '#lib/server/calendar.ts';
import { requireTutor } from '#lib/server/guards.ts';
import { formObject } from '#lib/validation/auth.ts';
import { and, eq, inArray } from 'drizzle-orm';
import { lesson } from '#lib/server/db/app.schema.ts';
import { lessonMeeting } from '#lib/server/db/v3.schema.ts';
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
	const v = url.searchParams.get('view');
	const view = v === 'day' || v === 'month' ? v : 'week';
	const d = url.searchParams.get('date') ?? '';
	const anchor = isIsoDate(d) ? fromLocal(d, 12 * 60) : new Date();
	let from: Date;
	let len: number;
	let prev: Date;
	let next: Date;
	if (view === 'month') {
		const ym = localDate(anchor).slice(0, 7);
		from = fromLocal(`${ym}-01`, 0);
		const [y, mo] = ym.split('-').map(Number);
		len = new Date(Date.UTC(y, mo, 0)).getUTCDate();
		prev = fromLocal(`${new Date(Date.UTC(y, mo - 2, 1)).toISOString().slice(0, 7)}-01`, 12 * 60);
		next = fromLocal(`${new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 7)}-01`, 12 * 60);
	} else {
		from = view === 'week' ? startOfLocalWeek(anchor) : startOfLocalDay(anchor);
		len = view === 'week' ? 7 : 1;
		prev = addDays(from, -len);
		next = addDays(from, len);
	}
	const to = addDays(from, len);
	const [lessons, events, requests, times] = await Promise.all([
		lessonsBetween(locals.db, t, from, to),
		eventsBetween(locals.db, t, from, to),
		pendingRequests(locals.db, t),
		listAvailability(locals.db, t)
	]);
	// in-person addresses and meeting links of THIS tutor's lessons in the range
	const ids = lessons.map((l) => l.id);
	const addrs: { id: number; address: string | null }[] = await locals.db
		.select({ id: lesson.id, address: lesson.address })
		.from(lesson)
		.where(and(eq(lesson.tutorId, t), inArray(lesson.id, ids)));
	const meetings: { lessonId: number; provider: 'meet' | 'teams'; joinUrl: string }[] =
		await locals.db
			.select({
				lessonId: lessonMeeting.lessonId,
				provider: lessonMeeting.provider,
				joinUrl: lessonMeeting.joinUrl
			})
			.from(lessonMeeting)
			.where(inArray(lessonMeeting.lessonId, ids));
	return {
		view,
		from,
		days: Array.from({ length: len }, (_, i) => localDate(addDays(from, i))),
		today: localDate(new Date()),
		prev: localDate(prev),
		next: localDate(next),
		lessons: lessons.map((l) => ({
			...l,
			address: addrs.find((a) => a.id === l.id)?.address ?? null,
			meeting: meetings.find((x) => x.lessonId === l.id)?.provider ?? null,
			joinUrl: meetings.find((x) => x.lessonId === l.id)?.joinUrl ?? null
		})),
		events,
		// waiting requests are shown differently (not yet lessons)
		requests: requests
			.filter((r) => r.startsAt >= from && r.startsAt < to)
			.map((r) => ({
				id: r.id,
				startsAt: r.startsAt,
				subjectName: r.subjectName,
				student: r.studentName.split(' ')[0],
				mode: r.mode
			})),
		times: times.map((x) => ({ weekday: x.weekday, start: x.startMinute, end: x.endMinute }))
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
	/** Holiday / not available from one day to another: no bookings are offered then. */
	addBlock: async ({ locals, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		const f = formObject(await request.formData());
		if (!isIsoDate(f.from ?? '') || !isIsoDate(f.to ?? '') || f.to < f.from)
			return fail(400, { error: 'err_times' });
		const startsAt = fromLocal(f.from, 0);
		const endsAt = fromLocal(f.to, 24 * 60);
		if (+endsAt - +startsAt > 366 * 86_400_000) return fail(400, { error: 'err_times' });
		await addEvent(locals.db, t, {
			title: (f.title ?? '').trim().slice(0, 80) || 'Not available',
			startsAt,
			endsAt,
			note: null,
			kind: 'blocked'
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
