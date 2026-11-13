import { and, asc, desc, eq, ilike, inArray, lt, ne, or, sql } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import {
	attendee,
	enrollment,
	homework,
	homeworkAnswer,
	lesson,
	profile,
	review,
	subject,
	tutorProfile
} from './db/app.schema.ts';
import { user } from './db/auth.schema.ts';
import { assessmentResult, lessonFeedback } from './db/v3.schema.ts';
import { recordResult } from './progress.ts';
import { localDate } from '../tz.ts';

/* ---------- which students belong to which tutor ---------- */

/** Link a student/parent account to a tutor (idempotent). */
export async function enroll(db: DB, tutorId: string, userId: string) {
	await db.insert(enrollment).values({ tutorId, userId }).onConflictDoNothing();
}

export async function isEnrolled(db: DB, tutorId: string, userId: string) {
	const r = await db
		.select({ u: enrollment.userId })
		.from(enrollment)
		.where(and(eq(enrollment.tutorId, tutorId), eq(enrollment.userId, userId)));
	return r.length > 0;
}

/** The tutors a student or parent is linked to. */
export function tutorsForUser(db: DB, userId: string) {
	return db
		.select({
			tutorId: tutorProfile.tutorId,
			slug: tutorProfile.slug,
			name: tutorProfile.tutorName,
			status: tutorProfile.status
		})
		.from(enrollment)
		.innerJoin(tutorProfile, eq(tutorProfile.tutorId, enrollment.tutorId))
		.where(eq(enrollment.userId, userId))
		.orderBy(asc(enrollment.createdAt));
}

/**
 * One of this user's tutors, by page address (or their first tutor when none is given).
 * Null if they are not linked to that tutor: a student can never act on another tutor's data.
 */
export async function myTutor(db: DB, userId: string, slug?: string | null) {
	const all = await tutorsForUser(db, userId);
	if (slug) return all.find((t) => t.slug === slug) ?? null;
	return all[0] ?? null;
}

/* ---------- students (tutor view: only their own) ---------- */

export async function listStudents(db: DB, tutorId: string, q?: string) {
	const search = q?.trim();
	return db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role,
			phone: profile.phone,
			level: enrollment.level,
			isUnder18: profile.isUnder18,
			parentName: profile.parentName,
			childName: profile.childName
		})
		.from(enrollment)
		.innerJoin(user, eq(user.id, enrollment.userId))
		.leftJoin(profile, eq(profile.userId, user.id))
		.where(
			and(
				eq(enrollment.tutorId, tutorId),
				eq(user.role, 'student'),
				search
					? or(
							ilike(user.name, `%${escapeLike(search)}%`),
							ilike(profile.childName, `%${escapeLike(search)}%`)
						)
					: undefined
			)
		)
		.orderBy(asc(user.name));
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** One of this tutor's students (null for anyone not enrolled with them). */
export async function getStudent(db: DB, tutorId: string, id: string) {
	const [s] = await db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role,
			createdAt: user.createdAt,
			phone: profile.phone,
			level: enrollment.level,
			isUnder18: profile.isUnder18,
			parentName: profile.parentName,
			parentPhone: profile.parentPhone,
			parentEmail: profile.parentEmail,
			childName: profile.childName
		})
		.from(enrollment)
		.innerJoin(user, eq(user.id, enrollment.userId))
		.leftJoin(profile, eq(profile.userId, user.id))
		.where(and(eq(enrollment.tutorId, tutorId), eq(user.id, id), eq(user.role, 'student')));
	return s ?? null;
}

export async function setLevel(db: DB, tutorId: string, userId: string, level: string | null) {
	await db
		.update(enrollment)
		.set({ level })
		.where(and(eq(enrollment.tutorId, tutorId), eq(enrollment.userId, userId)));
}

/** One student's lessons with this tutor, newest first, with the tutor's private notes. */
export function studentLessons(db: DB, tutorId: string, userId: string) {
	return db
		.select({
			lessonId: lesson.id,
			attendeeId: attendee.id,
			startsAt: lesson.startsAt,
			endsAt: lesson.endsAt,
			mode: lesson.mode,
			kind: lesson.kind,
			lessonStatus: lesson.status,
			attendeeStatus: attendee.status,
			subjectName: subject.name,
			note: attendee.privateNote,
			attendance: attendee.attendance,
			feedback: lessonFeedback.text
		})
		.from(attendee)
		.innerJoin(lesson, eq(lesson.id, attendee.lessonId))
		.leftJoin(subject, eq(subject.id, lesson.subjectId))
		.leftJoin(lessonFeedback, eq(lessonFeedback.attendeeId, attendee.id))
		.where(and(eq(attendee.userId, userId), eq(lesson.tutorId, tutorId)))
		.orderBy(desc(lesson.startsAt));
}

/** The tutor's private note on one place in one of THEIR lessons. */
/** After the lesson the tutor marks each student: completed or absent (only in THEIR lessons). */
export async function setAttendance(
	db: DB,
	tutorId: string,
	attendeeId: number,
	value: 'completed' | 'absent' | null
) {
	await db
		.update(attendee)
		.set({ attendance: value })
		.where(
			and(
				eq(attendee.id, attendeeId),
				sql`${attendee.lessonId} in (select ${lesson.id} from ${lesson} where ${lesson.tutorId} = ${tutorId} and ${lesson.startsAt} < now() and ${lesson.endsAt} > now() - interval '7 days')`
			)
		);
}

export async function setPrivateNote(
	db: DB,
	tutorId: string,
	attendeeId: number,
	note: string | null
) {
	await db
		.update(attendee)
		.set({ privateNote: note })
		.where(
			and(
				eq(attendee.id, attendeeId),
				sql`${attendee.lessonId} in (select ${lesson.id} from ${lesson} where ${lesson.tutorId} = ${tutorId})`
			)
		);
}

/**
 * What the tutor writes for the student after a lesson (the student sees it; the private note
 * stays private). Only for a place in one of THIS tutor's lessons that has already started,
 * and only for this student. Empty text removes it. Returns false when not allowed.
 */
export async function setLessonFeedback(
	db: DB,
	tutorId: string,
	studentId: string,
	attendeeId: number,
	text: string | null,
	now = new Date()
) {
	const [a] = await db
		.select({ id: attendee.id })
		.from(attendee)
		.innerJoin(lesson, eq(lesson.id, attendee.lessonId))
		.where(
			and(
				eq(attendee.id, attendeeId),
				eq(attendee.userId, studentId),
				eq(lesson.tutorId, tutorId),
				ne(attendee.status, 'cancelled'),
				ne(lesson.status, 'cancelled'),
				lt(lesson.startsAt, now)
			)
		);
	if (!a) return false;
	const clean = text?.trim().slice(0, 2000) || null;
	if (!clean) {
		await db.delete(lessonFeedback).where(eq(lessonFeedback.attendeeId, a.id));
		return true;
	}
	await db
		.insert(lessonFeedback)
		.values({ attendeeId: a.id, text: clean, updatedAt: now })
		.onConflictDoUpdate({
			target: lessonFeedback.attendeeId,
			set: { text: clean, updatedAt: now }
		});
	return true;
}

/* ---------- homework ---------- */

export async function giveHomework(
	db: DB,
	tutorId: string,
	v: {
		userId: string;
		title: string;
		note: string | null;
		dueOn: string | null;
		fileKey: string | null;
		fileName: string | null;
		/** optional: lets a marked answer count towards progress on this topic */
		subject?: string | null;
		topic?: string | null;
	}
) {
	const [row] = await db
		.insert(homework)
		.values({
			...v,
			subject: v.subject?.trim().slice(0, 60) || null,
			topic: v.topic?.trim().slice(0, 80) || null,
			tutorId
		})
		.returning();
	return row;
}

/** A student's homework; with tutorId, only from that tutor. */
export async function homeworkForUser(db: DB, userId: string, tutorId?: string) {
	const items = await db
		.select({ h: homework, tutorName: tutorProfile.tutorName })
		.from(homework)
		.leftJoin(tutorProfile, eq(tutorProfile.tutorId, homework.tutorId))
		.where(and(eq(homework.userId, userId), tutorId ? eq(homework.tutorId, tutorId) : undefined))
		.orderBy(desc(homework.createdAt))
		.then((rows) => rows.map((r) => ({ ...r.h, tutorName: r.tutorName })));
	if (!items.length) return [];
	const answers = await db
		.select()
		.from(homeworkAnswer)
		.where(
			inArray(
				homeworkAnswer.homeworkId,
				items.map((h) => h.id)
			)
		)
		.orderBy(asc(homeworkAnswer.createdAt));
	return items.map((h) => ({ ...h, answers: answers.filter((a) => a.homeworkId === h.id) }));
}

export async function getHomework(db: DB, id: number) {
	const [h] = await db.select().from(homework).where(eq(homework.id, id));
	return h ?? null;
}

export async function getAnswer(db: DB, id: number) {
	const [a] = await db
		.select({ a: homeworkAnswer, userId: homework.userId, tutorId: homework.tutorId })
		.from(homeworkAnswer)
		.innerJoin(homework, eq(homework.id, homeworkAnswer.homeworkId))
		.where(eq(homeworkAnswer.id, id));
	return a ?? null;
}

/** Student hands in an answer, only for their own homework. */
export async function handIn(
	db: DB,
	userId: string,
	homeworkId: number,
	v: { note: string | null; fileKey: string | null; fileName: string | null }
) {
	const h = await getHomework(db, homeworkId);
	if (!h || h.userId !== userId) return null;
	const [row] = await db
		.insert(homeworkAnswer)
		.values({ homeworkId, ...v })
		.returning();
	return row;
}

/** Answers handed in to this tutor that are not checked yet (newest first). */
export function answersToCheck(db: DB, tutorId: string) {
	return db
		.select({
			id: homeworkAnswer.id,
			note: homeworkAnswer.note,
			fileKey: homeworkAnswer.fileKey,
			fileName: homeworkAnswer.fileName,
			createdAt: homeworkAnswer.createdAt,
			title: homework.title,
			subject: homework.subject,
			topic: homework.topic,
			userId: homework.userId,
			studentName: user.name
		})
		.from(homeworkAnswer)
		.innerJoin(homework, eq(homework.id, homeworkAnswer.homeworkId))
		.innerJoin(user, eq(user.id, homework.userId))
		.where(and(eq(homework.tutorId, tutorId), sql`${homeworkAnswer.checkedAt} is null`))
		.orderBy(desc(homeworkAnswer.createdAt));
}

/** Homework this tutor set that has no answer yet (newest first). */
export function homeworkWaiting(db: DB, tutorId: string, limit = 30) {
	return db
		.select({
			id: homework.id,
			title: homework.title,
			dueOn: homework.dueOn,
			createdAt: homework.createdAt,
			studentName: user.name
		})
		.from(homework)
		.innerJoin(user, eq(user.id, homework.userId))
		.where(
			and(
				eq(homework.tutorId, tutorId),
				sql`not exists (select 1 from homework_answer a where a.homework_id = ${homework.id})`
			)
		)
		.orderBy(desc(homework.createdAt))
		.limit(limit);
}

/** The tutor marks an answer checked, with an optional comment (only answers to THEIR homework). */
export async function checkAnswer(
	db: DB,
	tutorId: string,
	answerId: number,
	comment: string | null
) {
	const done = await db
		.update(homeworkAnswer)
		.set({ feedback: comment, checkedAt: new Date() })
		.where(
			and(
				eq(homeworkAnswer.id, answerId),
				sql`${homeworkAnswer.homeworkId} in (select ${homework.id} from ${homework} where ${homework.tutorId} = ${tutorId})`
			)
		)
		.returning({ id: homeworkAnswer.id });
	return done.length > 0;
}

/**
 * The tutor marks an answer: comment, and optionally a score out of a maximum. Only answers
 * to THIS tutor's homework (checked in SQL). With a score and a homework subject and topic,
 * the mark also counts as a progress result (source 'homework'); marking again replaces it.
 * Returns false when the answer is not theirs or the score does not make sense.
 */
export async function markAnswer(
	db: DB,
	tutorId: string,
	answerId: number,
	v: { comment: string | null; score?: number | null; maxScore?: number | null },
	now = new Date()
) {
	const hasScore = v.score !== null && v.score !== undefined && Number.isFinite(v.score);
	let score: number | null = null;
	let maxScore: number | null = null;
	if (hasScore) {
		maxScore = Math.round(Number(v.maxScore));
		score = Math.round(Number(v.score));
		if (!Number.isFinite(maxScore) || maxScore < 1 || maxScore > 1000) return false;
		if (score < 0 || score > maxScore) return false;
	}
	return db.transaction(async (tx) => {
		const [row] = await tx
			.update(homeworkAnswer)
			.set({ feedback: v.comment, checkedAt: now, score, maxScore })
			.where(
				and(
					eq(homeworkAnswer.id, answerId),
					sql`${homeworkAnswer.homeworkId} in (select ${homework.id} from ${homework} where ${homework.tutorId} = ${tutorId})`
				)
			)
			.returning({ id: homeworkAnswer.id, homeworkId: homeworkAnswer.homeworkId });
		if (!row) return false;
		await tx.delete(assessmentResult).where(eq(assessmentResult.homeworkAnswerId, row.id));
		if (score !== null && maxScore !== null) {
			const [h] = await tx
				.select({
					userId: homework.userId,
					title: homework.title,
					subject: homework.subject,
					topic: homework.topic
				})
				.from(homework)
				.where(and(eq(homework.id, row.homeworkId), eq(homework.tutorId, tutorId)));
			if (h?.subject && h.topic)
				await recordResult(tx, {
					studentId: h.userId,
					tutorId,
					source: 'homework',
					title: h.title,
					subject: h.subject,
					topic: h.topic,
					score,
					maxScore,
					feedback: v.comment,
					homeworkAnswerId: row.id,
					takenOn: localDate(now),
					createdBy: tutorId
				});
		}
		return true;
	});
}

export async function giveFeedback(
	db: DB,
	tutorId: string,
	answerId: number,
	feedback: string | null
) {
	await db
		.update(homeworkAnswer)
		.set({ feedback })
		.where(
			and(
				eq(homeworkAnswer.id, answerId),
				sql`${homeworkAnswer.homeworkId} in (select ${homework.id} from ${homework} where ${homework.tutorId} = ${tutorId})`
			)
		);
}

/* ---------- reviews ---------- */

/** Only people with at least one past lesson that wasn't cancelled can review. */
/**
 * Only after a completed, paid lesson with THIS tutor: the lesson has ended, the student was
 * not marked absent, it was not a free intro chat, and it was paid (or covered by a package).
 */
export async function canReview(db: DB, tutorId: string, userId: string, now = new Date()) {
	const r = await db.execute(sql`
		select 1
		from ${attendee} a
		join ${lesson} l on l.id = a.lesson_id
		where a.user_id = ${userId} and l.tutor_id = ${tutorId}
		  and a.status = 'booked' and l.status <> 'cancelled' and l.ends_at < ${now}
		  and l.kind = 'lesson' and coalesce(a.attendance, 'completed') <> 'absent'
		  and (
		    a.student_package_id is not null
		    or exists (
		      select 1 from charge c
		      where c.attendee_id = a.id and not c.voided
		        and c.amount_cents <= coalesce((select sum(pa.amount_cents) from payment_allocation pa where pa.charge_id = c.id), 0)
		    )
		  )
		limit 1`);
	const rows = (r as unknown as { rows?: unknown[] }).rows ?? (r as unknown as unknown[]);
	return rows.length > 0;
}

export async function myReview(db: DB, tutorId: string, userId: string) {
	const [r] = await db
		.select()
		.from(review)
		.where(and(eq(review.tutorId, tutorId), eq(review.userId, userId)));
	return r ?? null;
}

/** First name only (privacy for children). */
export function displayNameFor(fullName: string) {
	const first = fullName.trim().split(/\s+/)[0] ?? '';
	return first.slice(0, 30) || 'Student';
}

/** One review per person; posting again replaces the text (it is the author's own words). */
export async function postReview(
	db: DB,
	tutorId: string,
	userId: string,
	fullName: string,
	rating: number,
	text: string,
	now = new Date()
) {
	if (!(await canReview(db, tutorId, userId, now))) return null;
	const [row] = await db
		.insert(review)
		.values({ tutorId, userId, displayName: displayNameFor(fullName), rating, text })
		.onConflictDoUpdate({
			target: [review.tutorId, review.userId],
			// new words: the tutor's old reply no longer fits; a hidden review stays hidden
			set: { rating, text, createdAt: now, reply: null, repliedAt: null }
		})
		.returning();
	return row;
}

export const allReviews = (db: DB, tutorId: string) =>
	db.select().from(review).where(eq(review.tutorId, tutorId)).orderBy(desc(review.createdAt));

/** Only the platform owner can hide or show a review (e.g. after a report); nobody edits its words. */
export async function setReviewHidden(db: DB, id: number, hidden: boolean) {
	await db.update(review).set({ hidden }).where(eq(review.id, id));
}

/** The tutor answers a review of THEM (shown under it). Empty text removes the reply. */
export async function replyToReview(db: DB, tutorId: string, id: number, text: string | null) {
	await db
		.update(review)
		.set({ reply: text, repliedAt: text ? new Date() : null })
		.where(and(eq(review.id, id), eq(review.tutorId, tutorId)));
}

/** The tutor reports an abusive review of THEM to the Tutora team. */
export async function reportReview(db: DB, tutorId: string, id: number, reason: string) {
	const done = await db
		.update(review)
		.set({ reportedAt: new Date(), reportReason: reason })
		.where(and(eq(review.id, id), eq(review.tutorId, tutorId)))
		.returning({ id: review.id });
	return done.length > 0;
}

export async function countStudents(db: DB, tutorId: string) {
	const [r] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(enrollment)
		.where(eq(enrollment.tutorId, tutorId));
	return r.n;
}
