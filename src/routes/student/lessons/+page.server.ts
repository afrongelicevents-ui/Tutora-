import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	BookingFail,
	bookingTutorId,
	cancelMyPlace,
	lessonsForUser,
	requestsForUser,
	respondToProposal,
	withdrawRequest
} from '#lib/server/bookings.ts';
import { packagesForUser } from '#lib/server/billing.ts';
import { canReview, tutorsForUser } from '#lib/server/people.ts';
import { getSettings } from '#lib/server/settings.ts';
import { myFavourites } from '#lib/server/student.ts';
import { meetingsFor } from '#lib/server/student-home.ts';
import { requireRole } from '#lib/server/guards.ts';
import { notifyTutor } from '#lib/server/notify.ts';
import { OPEN_BEFORE_MIN, CLOSE_AFTER_MIN } from '#lib/server/room.ts';
import { formObject } from '#lib/validation/auth.ts';
import { fmtDayTime } from '#lib/tz.ts';
import { m } from '#lib/paraglide/messages.js';

export const load: PageServerLoad = async ({ locals, url }) => {
	const u = requireRole(locals.user, url, ['student']);
	const now = new Date();
	const [lessons, requests, packages, tutors, favourites] = await Promise.all([
		lessonsForUser(locals.db, u.id),
		requestsForUser(locals.db, u.id),
		packagesForUser(locals.db, u.id),
		tutorsForUser(locals.db, u.id),
		myFavourites(locals.db, u.id)
	]);
	const meetings = await meetingsFor(
		locals.db,
		lessons.map((l) => l.id)
	);
	// each tutor's own cancel rule and contact; and whether this person may review them
	const myTutors = await Promise.all(
		tutors.map(async (t) => {
			const s = await getSettings(locals.db, t.tutorId);
			return {
				tutorId: t.tutorId,
				slug: t.slug,
				name: t.name,
				active: t.status === 'active',
				cancelHours: s.cancelHours,
				whatsapp: t.status === 'active' ? s.whatsappNumber : null,
				reviewable: t.status === 'active' && (await canReview(locals.db, t.tutorId, u.id, now))
			};
		})
	);
	const hours = (tutorId: string) => myTutors.find((t) => t.tutorId === tutorId)?.cancelHours ?? 24;
	return {
		now,
		favourites,
		tutors: myTutors.map(({ tutorId: _id, ...t }) => t),
		upcoming: lessons
			.filter((l) => l.endsAt.getTime() + CLOSE_AFTER_MIN * 60_000 > now.getTime())
			.map(({ tutorId, ...l }) => ({
				...l,
				meeting: meetings.get(l.id) ?? null,
				cancelHours: hours(tutorId),
				canCancel: l.startsAt.getTime() - now.getTime() >= hours(tutorId) * 3_600_000,
				roomOpen:
					l.mode === 'online' && now.getTime() >= l.startsAt.getTime() - OPEN_BEFORE_MIN * 60_000
			})),
		past: lessons
			.filter((l) => l.endsAt.getTime() + CLOSE_AFTER_MIN * 60_000 <= now.getTime())
			.map(({ tutorId: _t, ...l }) => l)
			.reverse(),
		requests,
		packages: packages
			.filter((p) => p.lessonsUsed < p.lessonsTotal)
			.map(({ tutorId: _t, ...p }) => p)
	};
};

const idOf = (f: Record<string, string>) => Number(f.id) || 0;
const handle = async (fn: () => Promise<unknown>) => {
	try {
		await fn();
		return null;
	} catch (e) {
		if (e instanceof BookingFail) return fail(400, { error: e.code });
		throw e;
	}
};

export const actions: Actions = {
	cancel: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['student']);
		const f = formObject(await request.formData());
		let lesson: { startsAt: Date; tutorId: string } | null = null;
		const err = await handle(async () => {
			lesson = await cancelMyPlace(locals.db, u.id, idOf(f));
		});
		if (err) return err;
		const { startsAt: when, tutorId } = lesson!;
		await notifyTutor(
			locals.db,
			tutorId,
			m.email_student_cancel_s(),
			m.email_student_cancel_b({ name: u.name, when: fmtDayTime(when) })
		);
		return { done: 'cancelled' };
	},
	withdraw: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['student']);
		const f = formObject(await request.formData());
		return (await handle(() => withdrawRequest(locals.db, u.id, idOf(f)))) ?? { done: 'withdrawn' };
	},
	respond: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['student']);
		const f = formObject(await request.formData());
		const yes = f.answer === 'yes';
		const tutorId = await bookingTutorId(locals.db, u.id, idOf(f));
		const err = await handle(() => respondToProposal(locals.db, u.id, idOf(f), yes));
		if (err) return err;
		if (tutorId)
			await notifyTutor(
				locals.db,
				tutorId,
				yes ? m.email_time_accepted_s() : m.email_time_declined_s(),
				yes ? m.email_time_accepted_b({ name: u.name }) : m.email_time_declined_b({ name: u.name })
			);
		return { done: yes ? 'accepted' : 'declined' };
	}
};
