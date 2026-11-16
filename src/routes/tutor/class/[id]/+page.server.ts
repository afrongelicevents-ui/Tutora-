import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { lessonWithPeople } from '#lib/server/bookings.ts';
import { requireTutor } from '#lib/server/guards.ts';
import { setAttendance } from '#lib/server/people.ts';
import { sendMessage } from '#lib/server/messages.ts';
import { notifyUser } from '#lib/server/notify.ts';
import { proAccess } from '#lib/server/pro.ts';
import { lessonLink } from '#lib/server/meeting-links.ts';
import { localDate } from '#lib/tz.ts';
import { m } from '#lib/paraglide/messages.js';

const lessonId = (p: string) => {
	const n = Number(p);
	if (!Number.isInteger(n) || n <= 0) error(404, 'Not found');
	return n;
};

/**
 * Pro: group class tools for one group lesson: the class list, one message to everyone,
 * one homework for everyone, mark everyone present, and the class link.
 */
export const load: PageServerLoad = async ({ locals, params, url }) => {
	const t = requireTutor(locals.user, url).id;
	const l = await lessonWithPeople(locals.db, lessonId(params.id), t);
	if (!l) error(404, 'Not found');
	const [pro, link] = await Promise.all([proAccess(locals.db, t), lessonLink(locals.db, l.id)]);
	const now = Date.now();
	return {
		lesson: {
			id: l.id,
			startsAt: l.startsAt,
			endsAt: l.endsAt,
			subjectName: l.subjectName ?? null,
			capacity: l.capacity
		},
		people: l.people.map((p) => ({
			attendeeId: p.attendeeId,
			userId: p.userId,
			name: p.childName ?? p.name,
			attendance: p.attendance
		})),
		pro: pro.active,
		classLink: link?.url ?? null,
		// attendance can be marked from the start until 7 days after
		canMark: l.startsAt.getTime() < now && l.endsAt.getTime() > now - 7 * 86_400_000,
		today: localDate(new Date())
	};
};

async function proOr403(locals: App.Locals, tutorId: string) {
	return (await proAccess(locals.db, tutorId)).active;
}

export const actions: Actions = {
	messageAll: async ({ locals, params, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		if (!(await proOr403(locals, t))) return fail(403, { error: 'pro_err_locked' });
		const l = await lessonWithPeople(locals.db, lessonId(params.id), t);
		if (!l) error(404, 'Not found');
		const text = String((await request.formData()).get('text') ?? '');
		let sent = 0;
		for (const userId of [...new Set(l.people.map((p) => p.userId))]) {
			const r = await sendMessage(locals.db, t, { tutorId: t, studentId: userId }, text);
			if (!r.ok) return fail(400, { error: r.error });
			await notifyUser(locals.db, userId, m.pro_class_msg_s(), text.slice(0, 140), {
				kind: 'message',
				link: `/student/messages/${t}`
			});
			sent++;
		}
		return { messaged: sent };
	},
	markAll: async ({ locals, params, url }) => {
		const t = requireTutor(locals.user, url).id;
		if (!(await proOr403(locals, t))) return fail(403, { error: 'pro_err_locked' });
		const l = await lessonWithPeople(locals.db, lessonId(params.id), t);
		if (!l) error(404, 'Not found');
		for (const p of l.people)
			if (!p.attendance) await setAttendance(locals.db, t, p.attendeeId, 'completed');
		return { marked: true };
	}
};
