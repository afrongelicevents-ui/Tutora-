import { and, eq, gt, isNull, lt } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { attendee, homework, homeworkAnswer, lesson, subject } from './db/app.schema.ts';
import { user } from './db/auth.schema.ts';
import type { Notify } from './notify-core.ts';
import { addDays, fmtDayTime, localDate } from '../tz.ts';
import { cleanupSignals } from './room.ts';
import { m } from '../paraglide/messages.js';

/**
 * Sends reminder emails about 24 hours and 1 hour before each lesson.
 * Called hourly (see .github/workflows/reminders.yml). Each reminder is sent once.
 */
export async function sendDueReminders(db: DB, notify: Notify, origin: string, now = new Date()) {
	let sent = 0;
	for (const [flag, hours] of [
		['reminded24', 24],
		['reminded1', 1]
	] as const) {
		const col = flag === 'reminded24' ? lesson.reminded24 : lesson.reminded1;
		const due = await db
			.select({
				id: lesson.id,
				tutorId: lesson.tutorId,
				kind: lesson.kind,
				startsAt: lesson.startsAt,
				mode: lesson.mode,
				subjectName: subject.name
			})
			.from(lesson)
			.leftJoin(subject, eq(subject.id, lesson.subjectId))
			.where(
				and(
					eq(lesson.status, 'scheduled'),
					eq(col, false),
					gt(lesson.startsAt, now),
					lt(lesson.startsAt, new Date(now.getTime() + hours * 3_600_000))
				)
			);
		for (const l of due) {
			// mark first so a crash never sends the same reminder twice
			const claimed = await db
				.update(lesson)
				.set({ [flag]: true })
				.where(and(eq(lesson.id, l.id), eq(col, false)))
				.returning({ id: lesson.id });
			// another run already sent this one
			if (!claimed.length) continue;
			const people = await db
				.select({ id: user.id, name: user.name })
				.from(attendee)
				.innerJoin(user, eq(user.id, attendee.userId))
				.where(and(eq(attendee.lessonId, l.id), eq(attendee.status, 'booked')));
			const subject =
				l.kind === 'intro' ? m.email_intro_word() : (l.subjectName ?? m.email_lesson_word());
			const title = (hours === 1 ? m.email_remind_hour_s : m.email_remind_tomorrow_s)({ subject });
			for (const p of people) {
				const where =
					l.mode === 'online'
						? m.email_remind_online({ url: `${origin}/student/lessons/${l.id}` })
						: m.email_remind_in_person();
				await notify(
					p.id,
					title,
					m.email_remind_b({ name: p.name, subject, when: fmtDayTime(l.startsAt), where }),
					{ kind: 'reminder', link: `/student/lessons/${l.id}` }
				).catch(() => {});
				sent++;
			}
			// the tutor is reminded too
			await notify(
				l.tutorId,
				title,
				m.remind_tutor_b({
					subject,
					when: fmtDayTime(l.startsAt),
					who: people.map((p) => p.name.split(' ')[0]).join(', ')
				}),
				{ kind: 'reminder', link: `/tutor/lessons/${l.id}` }
			).catch(() => {});
		}
	}
	await cleanupSignals(db, now);
	return sent;
}

/** "Homework due tomorrow" for homework that has no answer yet. Each one is reminded once. */
export async function sendHomeworkReminders(db: DB, notify: Notify, now = new Date()) {
	const tomorrow = localDate(addDays(now, 1));
	const due = await db
		.select({ id: homework.id, userId: homework.userId, title: homework.title })
		.from(homework)
		.leftJoin(homeworkAnswer, eq(homeworkAnswer.homeworkId, homework.id))
		.where(
			and(eq(homework.dueOn, tomorrow), isNull(homework.remindedAt), isNull(homeworkAnswer.id))
		);
	let sent = 0;
	for (const h of due) {
		const claimed = await db
			.update(homework)
			.set({ remindedAt: now })
			.where(and(eq(homework.id, h.id), isNull(homework.remindedAt)))
			.returning({ id: homework.id });
		if (!claimed.length) continue;
		await notify(h.userId, m.hw_due_s(), m.hw_due_b({ title: h.title }), {
			kind: 'homework',
			link: '/student/homework'
		}).catch(() => {});
		sent++;
	}
	return sent;
}
