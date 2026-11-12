/**
 * The pre-lesson brief a tutor sees on a booking request (and on Today): weak topics from real
 * results, the latest check-in the student shared with tutors, open or overdue homework from
 * THIS tutor, and what class is on at school (if the student or a parent entered it).
 * Every part is empty when there is no data; nothing is guessed.
 */
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { booking, enrollment, homework, homeworkAnswer } from './db/app.schema.ts';
import { weakTopics } from './progress.ts';
import { latestForTutor, type CheckinMood } from './checkins.ts';
import { schoolWork } from './school.ts';
import { localDate } from '../tz.ts';

export interface Brief {
	/** topics below the "needs practice" line, lowest first (max 2), this subject first */
	weak: { subject: string; topic: string; pct: number }[];
	/** the latest check-in shared with tutors (never the private note) */
	checkin: { mood: CheckinMood; subject: string | null; createdAt: Date } | null;
	/** homework from this tutor that has not been handed in */
	homework: { open: number; overdue: number; nextDue: string | null };
	/** what class is on at school in this subject, if entered */
	school: { subject: string; topic: string } | null;
	/** true when there is nothing at all to say */
	empty: boolean;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** "Maths" ~ "Mathematics", "Eng" ~ "English": loose, because names are typed by people. */
export function sameSubject(a: string | null | undefined, b: string | null | undefined) {
	if (!a || !b) return false;
	const x = norm(a);
	const y = norm(b);
	if (!x || !y) return false;
	return (
		x === y ||
		x.startsWith(y) ||
		y.startsWith(x) ||
		(x.length >= 4 && y.slice(0, 4) === x.slice(0, 4))
	);
}

/**
 * A tutor may see a brief only for their own students or for someone who has an open
 * request with them (the student chose to ask this tutor).
 */
export async function maySeeBrief(db: DB, tutorId: string, studentId: string) {
	const [e] = await db
		.select({ u: enrollment.userId })
		.from(enrollment)
		.where(and(eq(enrollment.tutorId, tutorId), eq(enrollment.userId, studentId)));
	if (e) return true;
	const [b] = await db
		.select({ id: booking.id })
		.from(booking)
		.where(
			and(
				eq(booking.tutorId, tutorId),
				eq(booking.userId, studentId),
				inArray(booking.status, ['requested', 'proposed'])
			)
		)
		.limit(1);
	return !!b;
}

/** Homework from this tutor without an answer yet. */
async function openHomework(db: DB, tutorId: string, studentId: string, today: string) {
	const [r] = await db
		.select({
			open: sql<number>`count(*)::int`,
			overdue: sql<number>`count(*) filter (where ${homework.dueOn} < ${today})::int`,
			nextDue: sql<
				string | null
			>`min(${homework.dueOn}) filter (where ${homework.dueOn} >= ${today})::text`
		})
		.from(homework)
		.leftJoin(homeworkAnswer, eq(homeworkAnswer.homeworkId, homework.id))
		.where(
			and(eq(homework.tutorId, tutorId), eq(homework.userId, studentId), isNull(homeworkAnswer.id))
		);
	return { open: r?.open ?? 0, overdue: r?.overdue ?? 0, nextDue: r?.nextDue ?? null };
}

/** The brief for one student, for this tutor. Null if the tutor may not see it. */
export async function preLessonBrief(
	db: DB,
	tutorId: string,
	studentId: string,
	opts: { subject?: string | null; now?: Date } = {}
): Promise<Brief | null> {
	if (!(await maySeeBrief(db, tutorId, studentId))) return null;
	const today = localDate(opts.now ?? new Date());
	const [weakAll, ci, hw, school] = await Promise.all([
		weakTopics(db, studentId, 20),
		latestForTutor(db, studentId),
		openHomework(db, tutorId, studentId, today),
		schoolWork(db, studentId)
	]);
	const subj = opts.subject ?? null;
	const weak = [...weakAll]
		.sort(
			(a, b) =>
				Number(sameSubject(b.subject, subj)) - Number(sameSubject(a.subject, subj)) || a.pct - b.pct
		)
		.slice(0, 2)
		.map((w) => ({ subject: w.subject, topic: w.topic, pct: w.pct }));
	const s = subj
		? school.subjects.find((x) => x.currentTopic && sameSubject(x.subject, subj))
		: school.subjects.length === 1 && school.subjects[0].currentTopic
			? school.subjects[0]
			: undefined;
	const brief: Brief = {
		weak,
		checkin: ci ? { mood: ci.mood, subject: ci.subject, createdAt: ci.createdAt } : null,
		homework: hw,
		school: s?.currentTopic ? { subject: s.subject, topic: s.currentTopic } : null,
		empty: false
	};
	brief.empty = !weak.length && !brief.checkin && !hw.open && !brief.school;
	return brief;
}

/** Briefs for several requests at once (Today screen), keyed by booking id. */
export async function briefsForRequests(
	db: DB,
	tutorId: string,
	requests: { id: number; userId: string; subjectName: string | null }[],
	now = new Date()
) {
	const out: Record<number, Brief | null> = {};
	await Promise.all(
		requests.map(async (r) => {
			out[r.id] = await preLessonBrief(db, tutorId, r.userId, { subject: r.subjectName, now });
		})
	);
	return out;
}
