import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	BookingFail,
	cancelMyPlace,
	lessonsForUser,
	requestsForUser,
	respondToProposal,
	withdrawRequest
} from '#lib/server/bookings.ts';
import { packagesForUser } from '#lib/server/billing.ts';
import { canReview } from '#lib/server/people.ts';
import { getSettings } from '#lib/server/settings.ts';
import { requireRole } from '#lib/server/guards.ts';
import { notifyTutor } from '#lib/server/notify.ts';
import { OPEN_BEFORE_MIN, CLOSE_AFTER_MIN } from '#lib/server/room.ts';
import { formObject } from '#lib/validation/auth.ts';
import { fmtDayTime } from '#lib/tz.ts';

export const load: PageServerLoad = async ({ locals }) => {
	const u = locals.user!;
	const now = new Date();
	const [lessons, requests, packages, s, reviewable] = await Promise.all([
		lessonsForUser(locals.db, u.id),
		requestsForUser(locals.db, u.id),
		packagesForUser(locals.db, u.id),
		getSettings(locals.db),
		canReview(locals.db, u.id, now)
	]);
	return {
		now,
		name: u.name,
		cancelHours: s.cancelHours,
		whatsapp: s.whatsappNumber,
		upcoming: lessons
			.filter((l) => l.endsAt.getTime() + CLOSE_AFTER_MIN * 60_000 > now.getTime())
			.map((l) => ({
				...l,
				canCancel: l.startsAt.getTime() - now.getTime() >= s.cancelHours * 3_600_000,
				roomOpen:
					l.mode === 'online' && now.getTime() >= l.startsAt.getTime() - OPEN_BEFORE_MIN * 60_000
			})),
		past: lessons
			.filter((l) => l.endsAt.getTime() + CLOSE_AFTER_MIN * 60_000 <= now.getTime())
			.reverse(),
		requests,
		packages: packages.filter((p) => p.lessonsUsed < p.lessonsTotal),
		reviewable
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
		const u = requireRole(locals.user, url, ['student', 'parent']);
		const f = formObject(await request.formData());
		let when: Date | null = null;
		const err = await handle(async () => {
			when = (await cancelMyPlace(locals.db, u.id, idOf(f))).startsAt;
		});
		if (err) return err;
		await notifyTutor(
			locals.db,
			'Lesson cancelled by student',
			`${u.name} cancelled their place on ${fmtDayTime(when!)}.`
		);
		return { done: 'cancelled' };
	},
	withdraw: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['student', 'parent']);
		const f = formObject(await request.formData());
		return (await handle(() => withdrawRequest(locals.db, u.id, idOf(f)))) ?? { done: 'withdrawn' };
	},
	respond: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['student', 'parent']);
		const f = formObject(await request.formData());
		const yes = f.answer === 'yes';
		const err = await handle(() => respondToProposal(locals.db, u.id, idOf(f), yes));
		if (err) return err;
		await notifyTutor(
			locals.db,
			yes ? 'New time accepted' : 'New time declined',
			`${u.name} ${yes ? 'accepted' : 'declined'} the time you suggested.`
		);
		return { done: yes ? 'accepted' : 'declined' };
	}
};
