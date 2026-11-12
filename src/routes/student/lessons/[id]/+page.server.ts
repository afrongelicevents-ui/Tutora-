import { error, fail } from '@sveltejs/kit';
import { and, asc, eq, ilike } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { fileLink } from '#lib/server/storage.ts';
import { myLesson } from '#lib/server/student.ts';
import { OPEN_BEFORE_MIN, CLOSE_AFTER_MIN } from '#lib/server/room.ts';
import {
	lessonFeedback,
	lessonMaterial,
	lessonMeeting,
	schoolInfo,
	schoolSubject
} from '#lib/server/db/v3.schema.ts';
import { BookingFail, cancelMyPlace } from '#lib/server/bookings.ts';
import { notifyTutor } from '#lib/server/notify.ts';
import { fmtDayTime } from '#lib/tz.ts';
import { m } from '#lib/paraglide/messages.js';

async function currentTopic(db: App.Locals['db'], studentId: string, subjectName: string | null) {
	if (!subjectName) return null;
	const [r] = await db
		.select({ topic: schoolSubject.currentTopic })
		.from(schoolSubject)
		.where(and(eq(schoolSubject.studentId, studentId), ilike(schoolSubject.subject, subjectName)));
	return r ?? null;
}

/** One of my lessons (only lessons I am booked on): how to join, materials, notes. */
export const load: PageServerLoad = async ({ locals, url, params }) => {
	const u = requireRole(locals.user, url, ['student']);
	const l = await myLesson(locals.db, u.id, Number(params.id) || 0);
	if (!l) error(404, 'Not found');
	const now = Date.now();
	const [[meeting], materials, [note], [school], topic] = await Promise.all([
		locals.db.select().from(lessonMeeting).where(eq(lessonMeeting.lessonId, l.id)),
		locals.db
			.select({
				id: lessonMaterial.id,
				kind: lessonMaterial.kind,
				title: lessonMaterial.title,
				url: lessonMaterial.url,
				fileKey: lessonMaterial.fileKey
			})
			.from(lessonMaterial)
			.where(eq(lessonMaterial.lessonId, l.id))
			.orderBy(asc(lessonMaterial.id)),
		locals.db
			.select({ text: lessonFeedback.text })
			.from(lessonFeedback)
			.where(eq(lessonFeedback.attendeeId, l.attendeeId)),
		locals.db
			.select({ year: schoolInfo.year })
			.from(schoolInfo)
			.where(eq(schoolInfo.studentId, u.id)),
		currentTopic(locals.db, u.id, l.subjectName)
	]);
	const { tutorId: _t, ...lesson } = l;
	return {
		lesson: {
			...lesson,
			minutes: Math.round((+l.endsAt - +l.startsAt) / 60_000),
			live: l.status === 'scheduled' && l.attendeeStatus === 'booked',
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
		},
		meeting: meeting ? { provider: meeting.provider, joinUrl: meeting.joinUrl } : null,
		materials: await Promise.all(
			materials.map(
				async (x: {
					id: number;
					kind: string;
					title: string;
					url: string | null;
					fileKey: string | null;
				}) => ({
					...x,
					url: x.url ?? (x.fileKey ? await fileLink(x.fileKey, x.title) : null),
					fileKey: undefined
				})
			)
		),
		note: note?.text ?? null,
		topic: topic?.topic ? { topic: topic.topic, year: school?.year ?? null } : null
	};
};

export const actions: Actions = {
	/** Cancel my place, only within the tutor's cancellation rule (checked again on the server). */
	cancel: async ({ locals, url, params }) => {
		const u = requireRole(locals.user, url, ['student']);
		try {
			const l = await cancelMyPlace(locals.db, u.id, Number(params.id) || 0);
			await notifyTutor(
				locals.db,
				l.tutorId,
				m.email_student_cancel_s(),
				m.email_student_cancel_b({ name: u.name, when: fmtDayTime(l.startsAt) })
			);
		} catch (e) {
			if (e instanceof BookingFail) return fail(400, { error: e.code });
			throw e;
		}
		return { cancelled: true };
	}
};
