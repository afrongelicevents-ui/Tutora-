import { error } from '@sveltejs/kit';
import { ORIGIN } from '$app/env/private';
import type { RequestHandler } from './$types';
import { isAttendee, lessonWithPeople } from '#lib/server/bookings.ts';
import { lessonIcs } from '#lib/server/calendar.ts';
import { requireUser } from '#lib/server/guards.ts';

/** "Add to my phone's calendar": only for the tutor and students booked on this lesson. */
export const GET: RequestHandler = async ({ locals, url, params }) => {
	const u = requireUser(locals.user, url);
	const id = Number(params.id) || 0;
	const isTutor = u.role === 'tutor' && u.twoFactorEnabled;
	if (!isTutor && !(await isAttendee(locals.db, u.id, id))) error(404, 'Not found');
	const l = await lessonWithPeople(locals.db, id);
	if (!l || l.status !== 'scheduled') error(404, 'Not found');
	const title = `${l.subjectName ?? 'Intro chat'} lesson (Tutora)`;
	const link = `${ORIGIN}${isTutor ? `/tutor/lessons/${l.id}` : '/student'}`;
	const ics = lessonIcs(
		{
			id: l.id,
			startsAt: l.startsAt,
			endsAt: l.endsAt,
			title,
			description:
				l.mode === 'online'
					? `Online lesson. Open ${link} and tap "Join lesson room".`
					: 'In-person lesson.',
			url: link
		},
		new URL(ORIGIN).host
	);
	return new Response(ics, {
		headers: {
			'content-type': 'text/calendar; charset=utf-8',
			'content-disposition': `attachment; filename="tutora-lesson-${l.id}.ics"`,
			'cache-control': 'private, no-store'
		}
	});
};
