/**
 * Data for the student's home screen, all from the student's own records.
 */
import { and, count, eq, gte, inArray, isNull, lte } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { homework, homeworkAnswer } from './db/app.schema.ts';
import { connectedAccount, lessonMeeting, toolPref } from './db/v3.schema.ts';
import { lessonsForUser } from './bookings.ts';
import { CLOSE_AFTER_MIN } from './room.ts';
import { addDays, localDate } from '../tz.ts';

export async function nextLessonFor(db: DB, userId: string, now = new Date()) {
	const lessons = await lessonsForUser(db, userId);
	const upcoming = lessons.filter(
		(l) => l.endsAt.getTime() + CLOSE_AFTER_MIN * 60_000 > now.getTime()
	);
	const next = upcoming[0];
	if (!next) return null;
	const [meeting] = await db
		.select({ provider: lessonMeeting.provider })
		.from(lessonMeeting)
		.where(eq(lessonMeeting.lessonId, next.id));
	return {
		id: next.id,
		subjectName: next.subjectName,
		tutorName: next.tutorName,
		kind: next.kind,
		mode: next.mode,
		startsAt: next.startsAt,
		meeting: meeting?.provider ?? null
	};
}

/** Homework not handed in yet, due within the next 7 days (or overdue). */
export async function homeworkDueCount(db: DB, userId: string, now = new Date()) {
	const [r] = await db
		.select({ n: count() })
		.from(homework)
		.leftJoin(homeworkAnswer, eq(homeworkAnswer.homeworkId, homework.id))
		.where(
			and(
				eq(homework.userId, userId),
				isNull(homeworkAnswer.id),
				lte(homework.dueOn, localDate(addDays(now, 7))),
				gte(homework.dueOn, localDate(addDays(now, -30)))
			)
		);
	return r?.n ?? 0;
}

/** Names of the tools this person has switched on (for "Connected tools · Meet, Drive"). */
export async function toolsSummary(db: DB, userId: string) {
	const [accounts, [pref]] = await Promise.all([
		db
			.select({ provider: connectedAccount.provider })
			.from(connectedAccount)
			.where(eq(connectedAccount.userId, userId)),
		db.select().from(toolPref).where(eq(toolPref.userId, userId))
	]);
	const out: string[] = [];
	if (accounts.some((a) => a.provider === 'google')) out.push('Google Drive');
	if (pref?.kahootOn) out.push('Kahoot!');
	return out;
}

export async function meetingsFor(db: DB, lessonIds: number[]) {
	if (!lessonIds.length) return new Map<number, 'meet' | 'teams'>();
	const rows = await db
		.select({ id: lessonMeeting.lessonId, provider: lessonMeeting.provider })
		.from(lessonMeeting)
		.where(inArray(lessonMeeting.lessonId, lessonIds));
	return new Map(rows.map((r) => [r.id, r.provider]));
}
