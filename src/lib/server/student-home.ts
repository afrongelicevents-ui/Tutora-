/**
 * Data for the student's home screen, all from the student's own records.
 */
import { and, count, desc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import type { AnyColumn } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { homework, homeworkAnswer } from './db/app.schema.ts';
import {
	assessmentResult,
	connectedAccount,
	lessonMeeting,
	studyPlanItem,
	studySession,
	toolPref
} from './db/v3.schema.ts';
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

/** Homework not handed in yet: due within the next 7 days (or overdue), or recent with no due date. */
export async function homeworkDueCount(db: DB, userId: string, now = new Date()) {
	const [r] = await db
		.select({ n: count() })
		.from(homework)
		.leftJoin(homeworkAnswer, eq(homeworkAnswer.homeworkId, homework.id))
		.where(
			and(
				eq(homework.userId, userId),
				isNull(homeworkAnswer.id),
				or(
					and(
						lte(homework.dueOn, localDate(addDays(now, 7))),
						gte(homework.dueOn, localDate(addDays(now, -30)))
					),
					// homework with no due date counts while it is recent (set in the last 30 days)
					and(isNull(homework.dueOn), gte(homework.createdAt, addDays(now, -30)))
				)
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

export interface Journey {
	/** running: a focus session is open now; session: last study session; lesson: last lesson */
	from: 'running' | 'session' | 'lesson';
	subject: string;
	topic: string | null;
	at: Date;
}

/**
 * "Your learning journey": what the student last worked on, from their own records only
 * (a running or finished study session, else their most recent past lesson). Null when new.
 */
export async function learningJourney(
	db: DB,
	userId: string,
	now = new Date()
): Promise<Journey | null> {
	const [s] = await db
		.select({
			subject: studySession.subject,
			topic: studySession.topic,
			status: studySession.status,
			startedAt: studySession.startedAt,
			endedAt: studySession.endedAt
		})
		.from(studySession)
		.where(eq(studySession.studentId, userId))
		.orderBy(desc(studySession.startedAt))
		.limit(1);
	const lessons = (await lessonsForUser(db, userId)).filter(
		(l) => l.subjectName && l.startsAt.getTime() < now.getTime()
	);
	const last = lessons.at(-1);
	const sessionAt = s ? (s.endedAt ?? s.startedAt) : null;
	if (s && (s.status === 'running' || !last || sessionAt!.getTime() >= last.startsAt.getTime()))
		return {
			from: s.status === 'running' ? 'running' : 'session',
			subject: s.subject,
			topic: s.topic,
			at: sessionAt!
		};
	if (last) return { from: 'lesson', subject: last.subjectName!, topic: null, at: last.startsAt };
	return null;
}

/**
 * The subjects this student actually has (study plan, study sessions, lessons, marked work,
 * homework), most recently active first. Names are merged without regard to case.
 */
export async function mySubjects(db: DB, userId: string): Promise<string[]> {
	const [plan, sessions, results, hw, lessons] = await Promise.all([
		db
			.select({ s: studyPlanItem.subject, at: sql<string>`max(${studyPlanItem.createdAt})::text` })
			.from(studyPlanItem)
			.where(eq(studyPlanItem.studentId, userId))
			.groupBy(studyPlanItem.subject),
		db
			.select({ s: studySession.subject, at: sql<string>`max(${studySession.startedAt})::text` })
			.from(studySession)
			.where(eq(studySession.studentId, userId))
			.groupBy(studySession.subject),
		db
			.select({
				s: assessmentResult.subject,
				at: sql<string>`max(${assessmentResult.takenOn})::text`
			})
			.from(assessmentResult)
			.where(eq(assessmentResult.studentId, userId))
			.groupBy(assessmentResult.subject),
		db
			.select({ s: homework.subject, at: sql<string>`max(${homework.createdAt})::text` })
			.from(homework)
			.where(eq(homework.userId, userId))
			.groupBy(homework.subject),
		lessonsForUser(db, userId)
	]);
	const seen = new Map<string, { name: string; at: number }>();
	const add = (name: string | null, at: string | Date | null) => {
		const n = name?.trim();
		if (!n) return;
		const t = at ? new Date(at).getTime() || 0 : 0;
		const k = n.toLowerCase();
		const cur = seen.get(k);
		if (!cur || t > cur.at) seen.set(k, { name: cur?.name ?? n, at: t });
	};
	for (const r of [...sessions, ...plan, ...results, ...hw]) add(r.s, r.at);
	for (const l of lessons) add(l.subjectName, l.startsAt);
	return [...seen.values()].sort((a, b) => b.at - a.at).map((x) => x.name);
}

/** One subject, for the student's subject page: only their own records for that subject. */
export async function subjectOverview(db: DB, userId: string, name: string, now = new Date()) {
	const same = (col: AnyColumn) => sql`lower(${col}) = lower(${name})`;
	const [results, openHomework, lessons, [lastSession]] = await Promise.all([
		db
			.select()
			.from(assessmentResult)
			.where(and(eq(assessmentResult.studentId, userId), same(assessmentResult.subject)))
			.orderBy(desc(assessmentResult.takenOn), desc(assessmentResult.id))
			.limit(5),
		db
			.select({ id: homework.id, title: homework.title, dueOn: homework.dueOn })
			.from(homework)
			.leftJoin(homeworkAnswer, eq(homeworkAnswer.homeworkId, homework.id))
			.where(and(eq(homework.userId, userId), isNull(homeworkAnswer.id), same(homework.subject)))
			.orderBy(homework.dueOn),
		lessonsForUser(db, userId),
		db
			.select({
				topic: studySession.topic,
				startedAt: studySession.startedAt,
				endedAt: studySession.endedAt
			})
			.from(studySession)
			.where(and(eq(studySession.studentId, userId), same(studySession.subject)))
			.orderBy(desc(studySession.startedAt))
			.limit(1)
	]);
	const mine = lessons.filter((l) => l.subjectName?.toLowerCase() === name.toLowerCase());
	const next = mine.find((l) => l.endsAt.getTime() > now.getTime()) ?? null;
	return {
		results,
		homework: openHomework,
		nextLesson: next
			? { id: next.id, startsAt: next.startsAt, tutorName: next.tutorName, mode: next.mode }
			: null,
		lessonsDone: mine.filter((l) => l.endsAt.getTime() <= now.getTime()).length,
		lastStudied: lastSession ? (lastSession.endedAt ?? lastSession.startedAt) : null
	};
}
