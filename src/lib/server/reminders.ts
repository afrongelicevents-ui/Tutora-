import { and, eq, gt, lt } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { attendee, lesson, subject } from './db/app.schema.ts';
import { user } from './db/auth.schema.ts';
import type { SendEmail } from './auth-config.ts';
import { fmtDayTime } from '../tz.ts';
import { cleanupSignals } from './room.ts';
import { m } from '../paraglide/messages.js';

/**
 * Sends reminder emails about 24 hours and 1 hour before each lesson.
 * Called hourly (see .github/workflows/reminders.yml). Each reminder is sent once.
 */
export async function sendDueReminders(
	db: DB,
	sendEmail: SendEmail,
	origin: string,
	now = new Date()
) {
	let sent = 0;
	for (const [flag, hours] of [
		['reminded24', 24],
		['reminded1', 1]
	] as const) {
		const col = flag === 'reminded24' ? lesson.reminded24 : lesson.reminded1;
		const due = await db
			.select({
				id: lesson.id,
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
				.select({ email: user.email, name: user.name })
				.from(attendee)
				.innerJoin(user, eq(user.id, attendee.userId))
				.where(and(eq(attendee.lessonId, l.id), eq(attendee.status, 'booked')));
			for (const p of people) {
				const where =
					l.mode === 'online'
						? m.email_remind_online({ url: `${origin}/student` })
						: m.email_remind_in_person();
				const subject = l.subjectName ?? m.email_lesson_word();
				await sendEmail({
					to: p.email,
					subject:
						hours === 1
							? m.email_remind_hour_s({ subject })
							: m.email_remind_tomorrow_s({ subject }),
					text: m.email_remind_b({ name: p.name, subject, when: fmtDayTime(l.startsAt), where })
				}).catch(() => {});
				sent++;
			}
		}
	}
	await cleanupSignals(db, now);
	return sent;
}
