import { and, asc, desc, eq, ilike, inArray, lt, ne, or, sql } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import {
	attendee,
	homework,
	homeworkAnswer,
	lesson,
	profile,
	review,
	subject
} from './db/app.schema.ts';
import { user } from './db/auth.schema.ts';

/* ---------- students (tutor view) ---------- */

export async function listStudents(db: DB, q?: string) {
	const search = q?.trim();
	return db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role,
			phone: profile.phone,
			level: profile.level,
			isUnder18: profile.isUnder18,
			parentName: profile.parentName,
			childName: profile.childName
		})
		.from(user)
		.leftJoin(profile, eq(profile.userId, user.id))
		.where(
			and(
				inArray(user.role, ['student', 'parent']),
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

export async function getStudent(db: DB, id: string) {
	const [s] = await db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role,
			createdAt: user.createdAt,
			phone: profile.phone,
			level: profile.level,
			isUnder18: profile.isUnder18,
			parentName: profile.parentName,
			parentPhone: profile.parentPhone,
			parentEmail: profile.parentEmail,
			childName: profile.childName
		})
		.from(user)
		.leftJoin(profile, eq(profile.userId, user.id))
		.where(and(eq(user.id, id), inArray(user.role, ['student', 'parent'])));
	return s ?? null;
}

export async function setLevel(db: DB, userId: string, level: string | null) {
	await db.update(profile).set({ level }).where(eq(profile.userId, userId));
}

/** All of one student's lessons, newest first, with the tutor's private notes. */
export function studentLessons(db: DB, userId: string) {
	return db
		.select({
			lessonId: lesson.id,
			attendeeId: attendee.id,
			startsAt: lesson.startsAt,
			mode: lesson.mode,
			kind: lesson.kind,
			lessonStatus: lesson.status,
			attendeeStatus: attendee.status,
			subjectName: subject.name,
			note: attendee.privateNote
		})
		.from(attendee)
		.innerJoin(lesson, eq(lesson.id, attendee.lessonId))
		.leftJoin(subject, eq(subject.id, lesson.subjectId))
		.where(eq(attendee.userId, userId))
		.orderBy(desc(lesson.startsAt));
}

export async function setPrivateNote(db: DB, attendeeId: number, note: string | null) {
	await db.update(attendee).set({ privateNote: note }).where(eq(attendee.id, attendeeId));
}

/* ---------- homework ---------- */

export async function giveHomework(
	db: DB,
	v: {
		userId: string;
		title: string;
		note: string | null;
		dueOn: string | null;
		fileKey: string | null;
		fileName: string | null;
	}
) {
	const [row] = await db.insert(homework).values(v).returning();
	return row;
}

export async function homeworkForUser(db: DB, userId: string) {
	const items = await db
		.select()
		.from(homework)
		.where(eq(homework.userId, userId))
		.orderBy(desc(homework.createdAt));
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
		.select({ a: homeworkAnswer, userId: homework.userId })
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

export async function giveFeedback(db: DB, answerId: number, feedback: string | null) {
	await db.update(homeworkAnswer).set({ feedback }).where(eq(homeworkAnswer.id, answerId));
}

/* ---------- reviews ---------- */

/** Only people with at least one past lesson that wasn't cancelled can review. */
export async function canReview(db: DB, userId: string, now = new Date()) {
	const r = await db
		.select({ id: attendee.id })
		.from(attendee)
		.innerJoin(lesson, eq(lesson.id, attendee.lessonId))
		.where(
			and(
				eq(attendee.userId, userId),
				eq(attendee.status, 'booked'),
				ne(lesson.status, 'cancelled'),
				lt(lesson.endsAt, now)
			)
		)
		.limit(1);
	return r.length > 0;
}

export async function myReview(db: DB, userId: string) {
	const [r] = await db.select().from(review).where(eq(review.userId, userId));
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
	userId: string,
	fullName: string,
	rating: number,
	text: string,
	now = new Date()
) {
	if (!(await canReview(db, userId, now))) return null;
	const [row] = await db
		.insert(review)
		.values({ userId, displayName: displayNameFor(fullName), rating, text })
		.onConflictDoUpdate({ target: review.userId, set: { rating, text, createdAt: now } })
		.returning();
	return row;
}

export const allReviews = (db: DB) => db.select().from(review).orderBy(desc(review.createdAt));

/** The tutor can hide or show a review, but never change its words. */
export async function setReviewHidden(db: DB, id: number, hidden: boolean) {
	await db.update(review).set({ hidden }).where(eq(review.id, id));
}

export async function countStudents(db: DB) {
	const [r] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(user)
		.where(inArray(user.role, ['student', 'parent']));
	return r.n;
}
