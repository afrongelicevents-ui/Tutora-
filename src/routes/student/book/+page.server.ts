import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import {
	availableSlots,
	BookingFail,
	openGroupLessons,
	requestBooking
} from '#lib/server/bookings.ts';
import { publicSite } from '#lib/server/settings.ts';
import { requireRole } from '#lib/server/guards.ts';
import { hitLimit } from '#lib/server/rate-limit.ts';
import { notifyTutor } from '#lib/server/notify.ts';
import { formObject } from '#lib/validation/auth.ts';
import { fmtDayTime, localDate } from '#lib/tz.ts';
import { m } from '#lib/paraglide/messages.js';

export const load: PageServerLoad = async ({ locals, url }) => {
	const intro = url.searchParams.get('intro') === '1';
	const [site, slots, groups] = await Promise.all([
		publicSite(locals.db),
		availableSlots(locals.db, intro ? 'intro' : 'lesson'),
		intro ? [] : openGroupLessons(locals.db)
	]);
	// group the free times by day for the form
	const days: { date: string; slots: Date[] }[] = [];
	for (const s of slots.slice(0, 60)) {
		const d = localDate(s);
		const last = days.at(-1);
		if (last?.date === d) last.slots.push(s);
		else days.push({ date: d, slots: [s] });
	}
	return { intro, site, days, groups, subject: Number(url.searchParams.get('subject')) || null };
};

const schema = z.object({
	kind: z.enum(['lesson', 'intro']),
	subjectId: z.coerce.number().int().positive().optional(),
	mode: z.enum(['online', 'in_person']).default('online'),
	slot: z.string().optional(),
	join: z.coerce.number().int().positive().optional(),
	note: z.string().trim().max(500, 'err_too_long').optional()
});

export const actions: Actions = {
	default: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['student', 'parent']);
		const limit = await hitLimit(locals.db, 'booking', u.id);
		if (!limit.ok)
			return fail(429, {
				error: 'err_rate_limited',
				minutes: Math.ceil(limit.retryAfterSeconds / 60)
			});
		const p = schema.safeParse(formObject(await request.formData()));
		if (!p.success) return fail(400, { error: 'err_pick_time' });
		const v = p.data;
		if (v.kind === 'lesson' && !v.subjectId) return fail(400, { error: 'err_subject' });
		const startsAt = v.slot ? new Date(v.slot) : null;
		if (!v.join && (!startsAt || Number.isNaN(startsAt.getTime())))
			return fail(400, { error: 'err_pick_time' });
		try {
			const b = await requestBooking(locals.db, u.id, {
				kind: v.kind,
				subjectId: v.subjectId ?? null,
				mode: v.mode,
				startsAt: v.join ? null : startsAt,
				joinLessonId: v.join ?? null,
				note: v.note || null
			});
			await notifyTutor(
				locals.db,
				m.email_booking_new_s(),
				m.email_booking_new_b({
					name: u.name,
					what: v.kind === 'intro' ? m.email_what_intro() : m.email_what_lesson(),
					when: fmtDayTime(b.startsAt)
				})
			);
		} catch (e) {
			if (e instanceof BookingFail) return fail(400, { error: e.code });
			throw e;
		}
		redirect(303, '/student?requested=1');
	}
};
