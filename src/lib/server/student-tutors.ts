/**
 * The student's Tutors tab: my tutors (with next lesson and unread messages), work to do from
 * tutors, latest messages and the real status of the connected tools. Real records only.
 */
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { enrollment, homework, homeworkAnswer, subject, tutorProfile } from './db/app.schema.ts';
import { questionSet, quizAssignment } from './db/v3.schema.ts';
import { lessonsForUser } from './bookings.ts';
import { CLOSE_AFTER_MIN } from './room.ts';
import { unreadByTutor } from './messages.ts';
import { addDays, localDate } from '../tz.ts';

export async function myTutors(db: DB, studentId: string, now = new Date()) {
	const rows = await db
		.select({
			tutorId: tutorProfile.tutorId,
			name: tutorProfile.tutorName,
			slug: tutorProfile.slug,
			photoKey: tutorProfile.photoKey,
			photoVersion: tutorProfile.photoVersion
		})
		.from(enrollment)
		.innerJoin(tutorProfile, eq(tutorProfile.tutorId, enrollment.tutorId))
		.where(eq(enrollment.userId, studentId))
		.orderBy(asc(enrollment.createdAt));
	if (!rows.length) return [];
	const ids = rows.map((r) => r.tutorId);
	const [subs, lessons, unread] = await Promise.all([
		db
			.select({ tutorId: subject.tutorId, name: subject.name })
			.from(subject)
			.where(and(inArray(subject.tutorId, ids), eq(subject.active, true)))
			.orderBy(asc(subject.sortOrder), asc(subject.id)),
		lessonsForUser(db, studentId),
		unreadByTutor(db, studentId)
	]);
	const live = lessons.filter((l) => l.endsAt.getTime() + CLOSE_AFTER_MIN * 60_000 > now.getTime());
	return rows.map((r) => {
		const next = live.find((l) => l.tutorId === r.tutorId);
		// the subjects this student has lessons in first, then the tutor's other subjects
		const mine = [
			...new Set(lessons.filter((l) => l.tutorId === r.tutorId).map((l) => l.subjectName))
		];
		const theirs = subs.filter((s) => s.tutorId === r.tutorId).map((s) => s.name);
		const subjects = [...new Set([...mine, ...theirs].filter((x): x is string => !!x))].slice(0, 3);
		return {
			tutorId: r.tutorId,
			name: r.name ?? '',
			slug: r.slug,
			hasPhoto: !!r.photoKey,
			photoVersion: r.photoVersion,
			subjects,
			next: next ? { id: next.id, startsAt: next.startsAt } : null,
			unread: unread.get(r.tutorId) ?? 0
		};
	});
}

export interface TodoItem {
	key: string;
	kind: 'homework' | 'quiz';
	title: string;
	tutorName: string;
	dueOn: string | null;
	href: string;
}

/** Homework not handed in and quizzes not done yet, soonest first (overdue up to 30 days). */
export async function todoFromTutors(db: DB, studentId: string, now = new Date()) {
	const since = localDate(addDays(now, -30));
	const [hw, quizzes] = await Promise.all([
		db
			.select({
				id: homework.id,
				title: homework.title,
				dueOn: homework.dueOn,
				tutorName: tutorProfile.tutorName
			})
			.from(homework)
			.leftJoin(homeworkAnswer, eq(homeworkAnswer.homeworkId, homework.id))
			.leftJoin(tutorProfile, eq(tutorProfile.tutorId, homework.tutorId))
			.where(and(eq(homework.userId, studentId), isNull(homeworkAnswer.id))),
		db
			.select({
				id: quizAssignment.id,
				title: questionSet.title,
				dueOn: quizAssignment.dueOn,
				tutorName: tutorProfile.tutorName
			})
			.from(quizAssignment)
			.innerJoin(questionSet, eq(questionSet.id, quizAssignment.setId))
			.leftJoin(tutorProfile, eq(tutorProfile.tutorId, questionSet.tutorId))
			.where(and(eq(quizAssignment.studentId, studentId), isNull(quizAssignment.doneAt)))
	]);
	const items: TodoItem[] = [
		...hw.map((h) => ({
			key: `h${h.id}`,
			kind: 'homework' as const,
			title: h.title,
			tutorName: h.tutorName ?? '',
			dueOn: h.dueOn,
			href: '/student/homework'
		})),
		...quizzes.map((q) => ({
			key: `q${q.id}`,
			kind: 'quiz' as const,
			title: q.title,
			tutorName: q.tutorName ?? '',
			dueOn: q.dueOn,
			href: `/student/quiz/${q.id}`
		}))
	].filter((i) => !i.dueOn || i.dueOn >= since);
	// dated work first, soonest first; undated last
	items.sort((a, b) => (a.dueOn ?? '9999').localeCompare(b.dueOn ?? '9999'));
	return items;
}
