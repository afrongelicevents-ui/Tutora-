import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { parentAccess } from '#lib/server/family.ts';
import {
	availableSlots,
	BookingFail,
	openGroupLessons,
	requestBooking
} from '#lib/server/bookings.ts';
import {
	activeTutorBySlug,
	listTutors,
	publicSite,
	type PublicSite
} from '#lib/server/settings.ts';
import { tutorsForUser } from '#lib/server/people.ts';
import { hitLimit } from '#lib/server/rate-limit.ts';
import { notifyTutor } from '#lib/server/notify.ts';
import { user } from '#lib/server/db/auth.schema.ts';
import { formObject } from '#lib/validation/auth.ts';
import { fmtDayTime, localDate } from '#lib/tz.ts';
import { shortName } from '#lib/names.ts';
import { m } from '#lib/paraglide/messages.js';
import type { DB } from '#lib/server/db/types.ts';

/** A guardian books for their child: the booking is the child's, like the child booking it. */
async function forChild(db: DB, parentId: string, url: URL) {
	const childId = url.searchParams.get('child') ?? '';
	const a = await parentAccess(db, parentId, childId);
	if (!a.ok || !a.guardian) error(404, 'Not found');
	const [c] = await db.select({ name: user.name }).from(user).where(eq(user.id, childId));
	return { id: childId, name: c?.name ?? '' };
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const u = requireRole(locals.user, url, ['parent']);
	const kid = await forChild(locals.db, u.id, url);
	const slug = url.searchParams.get('tutor');
	if (!slug) {
		const q = (url.searchParams.get('q') ?? '').trim().slice(0, 60);
		const [mine, found] = await Promise.all([
			tutorsForUser(locals.db, kid.id),
			q ? listTutors(locals.db, { q }) : Promise.resolve([])
		]);
		return {
			mode: 'pick' as const,
			kid: { id: kid.id, name: shortName(kid.name) },
			q,
			mine: mine.filter((t) => t.status === 'active').map((t) => ({ slug: t.slug, name: t.name })),
			found: found.slice(0, 10).map((t) => ({ slug: t.slug, name: t.name, subjects: t.subjects }))
		};
	}
	const tutor = await activeTutorBySlug(locals.db, slug);
	if (!tutor) redirect(303, `/parent/book?child=${encodeURIComponent(kid.id)}`);
	const intro = url.searchParams.get('intro') === '1' && tutor.offersIntro;
	const [site, slots, groups] = await Promise.all([
		publicSite(locals.db, tutor),
		availableSlots(locals.db, tutor.tutorId, intro ? 'intro' : 'lesson'),
		intro ? [] : openGroupLessons(locals.db, tutor.tutorId)
	]);
	const days: { date: string; slots: Date[] }[] = [];
	for (const s of slots.slice(0, 60)) {
		const d = localDate(s);
		const last = days.at(-1);
		if (last?.date === d) last.slots.push(s);
		else days.push({ date: d, slots: [s] });
	}
	const { tutorId: _id, whatsapp: _w, phone: _p, email: _e, ...pub } = site as PublicSite;
	return {
		mode: 'book' as const,
		kid: { id: kid.id, name: shortName(kid.name) },
		intro,
		site: pub,
		days,
		groups
	};
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
		const u = requireRole(locals.user, url, ['parent']);
		const kid = await forChild(locals.db, u.id, url);
		const tutor = await activeTutorBySlug(locals.db, url.searchParams.get('tutor') ?? '');
		if (!tutor) return fail(400, { error: 'err_not_found' });
		const limit = await hitLimit(locals.db, 'booking', u.id);
		if (!limit.ok) return fail(429, { error: 'err_rate_limited' });
		const p = schema.safeParse(formObject(await request.formData()));
		if (!p.success) return fail(400, { error: 'err_pick_time' });
		const v = p.data;
		if (v.kind === 'lesson' && !v.subjectId) return fail(400, { error: 'err_subject' });
		const startsAt = v.slot ? new Date(v.slot) : null;
		if (!v.join && (!startsAt || Number.isNaN(startsAt.getTime())))
			return fail(400, { error: 'err_pick_time' });
		try {
			const b = await requestBooking(locals.db, tutor.tutorId, kid.id, {
				kind: v.kind,
				subjectId: v.subjectId ?? null,
				mode: v.mode,
				startsAt: v.join ? null : startsAt,
				joinLessonId: v.join ?? null,
				note: v.note || null
			});
			await notifyTutor(
				locals.db,
				tutor.tutorId,
				m.email_booking_new_s(),
				m.email_booking_new_b({
					name: `${kid.name} (${m.par3_booked_by({ name: u.name })})`,
					what: v.kind === 'intro' ? m.email_what_intro() : m.email_what_lesson(),
					when: fmtDayTime(b.startsAt)
				})
			);
		} catch (e) {
			if (e instanceof BookingFail) return fail(400, { error: e.code });
			throw e;
		}
		redirect(303, `/parent?child=${encodeURIComponent(kid.id)}&booked=1`);
	}
};
