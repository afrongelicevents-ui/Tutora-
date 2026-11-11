import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { myLesson } from '#lib/server/student.ts';
import { OPEN_BEFORE_MIN, CLOSE_AFTER_MIN } from '#lib/server/room.ts';

/** One of my lessons (only lessons I am booked on). */
export const load: PageServerLoad = async ({ locals, url, params }) => {
	const u = requireRole(locals.user, url, ['student', 'parent']);
	const l = await myLesson(locals.db, u.id, Number(params.id) || 0);
	if (!l) error(404, 'Not found');
	const now = Date.now();
	return {
		lesson: {
			...l,
			minutes: Math.round((+l.endsAt - +l.startsAt) / 60_000),
			roomOpen:
				l.mode === 'online' &&
				l.status === 'scheduled' &&
				l.attendeeStatus === 'booked' &&
				now >= +l.startsAt - OPEN_BEFORE_MIN * 60_000 &&
				now <= +l.endsAt + CLOSE_AFTER_MIN * 60_000,
			canCancel:
				l.status === 'scheduled' &&
				l.attendeeStatus === 'booked' &&
				+l.startsAt - now >= l.cancelHours * 3_600_000,
			past: +l.endsAt < now
		}
	};
};
