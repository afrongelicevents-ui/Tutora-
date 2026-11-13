/**
 * Student ↔ tutor messages. Only between a student and a tutor they are enrolled with; text
 * only; parents connected to an under-18 student can read (never write in) the conversation.
 */
import { and, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { user } from './db/auth.schema.ts';
import { attendee, enrollment, lesson, profile, tutorProfile } from './db/app.schema.ts';
import { familyLink } from './db/v3.schema.ts';
import { tutorMessage } from './db/messages.schema.ts';

export const MESSAGE_MAX = 1000;

export async function enrolled(db: DB, tutorId: string, studentId: string) {
	// only student accounts (never a parent account that booked or paid)
	const [stu] = await db.select({ role: user.role }).from(user).where(eq(user.id, studentId));
	if (stu?.role !== 'student') return false;
	const [r] = await db
		.select({ t: enrollment.tutorId })
		.from(enrollment)
		.where(and(eq(enrollment.tutorId, tutorId), eq(enrollment.userId, studentId)));
	if (r) return true;
	// lessons booked with this tutor also make them this student's tutor (same rule as the
	// Tutors tab), e.g. lessons a parent booked before Family Connection
	const [l] = await db
		.select({ id: attendee.id })
		.from(attendee)
		.innerJoin(lesson, eq(lesson.id, attendee.lessonId))
		.where(
			and(
				eq(attendee.userId, studentId),
				eq(attendee.status, 'booked'),
				eq(lesson.tutorId, tutorId)
			)
		)
		.limit(1);
	return !!l;
}

/** Parents who may read an under-18 student's conversations. */
export async function readingParents(db: DB, studentId: string) {
	const [p] = await db
		.select({ u18: profile.isUnder18 })
		.from(profile)
		.where(eq(profile.userId, studentId));
	if (!p?.u18) return [];
	const rows = await db
		.select({ id: familyLink.parentId })
		.from(familyLink)
		.where(and(eq(familyLink.studentId, studentId), eq(familyLink.status, 'active')));
	return rows.map((r) => r.id);
}

export async function sendMessage(
	db: DB,
	fromId: string,
	pair: { tutorId: string; studentId: string },
	text: string
): Promise<{ ok: true; toId: string } | { ok: false; error: string }> {
	const body = text.replace(/\r\n/g, '\n').trim();
	if (!body) return { ok: false, error: 'msg_err_empty' };
	if (body.length > MESSAGE_MAX) return { ok: false, error: 'msg_err_long' };
	if (fromId !== pair.tutorId && fromId !== pair.studentId)
		return { ok: false, error: 'msg_err_not_allowed' };
	if (!(await enrolled(db, pair.tutorId, pair.studentId)))
		return { ok: false, error: 'msg_err_not_allowed' };
	await db.insert(tutorMessage).values({ ...pair, fromId, body });
	return { ok: true, toId: fromId === pair.tutorId ? pair.studentId : pair.tutorId };
}

export interface Conversation {
	otherId: string;
	otherName: string;
	/** tutors: public page slug, for the photo */
	slug: string | null;
	photoVersion: number;
	hasPhoto: boolean;
	last: string;
	lastAt: Date;
	lastFromMe: boolean;
	unread: number;
}

/** Latest message per conversation, newest first. `side` is whose list it is. */
export async function conversations(
	db: DB,
	meId: string,
	side: 'student' | 'tutor'
): Promise<Conversation[]> {
	const mine = side === 'student' ? tutorMessage.studentId : tutorMessage.tutorId;
	const other = side === 'student' ? tutorMessage.tutorId : tutorMessage.studentId;
	const rows = await db
		.selectDistinctOn([other], {
			otherId: other,
			body: tutorMessage.body,
			fromId: tutorMessage.fromId,
			createdAt: tutorMessage.createdAt
		})
		.from(tutorMessage)
		.where(eq(mine, meId))
		.orderBy(other, desc(tutorMessage.createdAt), desc(tutorMessage.id));
	if (!rows.length) return [];
	const ids = rows.map((r) => r.otherId);
	const [names, tps, unread] = await Promise.all([
		db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, ids)),
		side === 'student'
			? db
					.select({
						id: tutorProfile.tutorId,
						name: tutorProfile.tutorName,
						slug: tutorProfile.slug,
						photoKey: tutorProfile.photoKey,
						photoVersion: tutorProfile.photoVersion
					})
					.from(tutorProfile)
					.where(inArray(tutorProfile.tutorId, ids))
			: Promise.resolve([]),
		db
			.select({ otherId: other, n: sql<number>`count(*)::int` })
			.from(tutorMessage)
			.where(and(eq(mine, meId), ne(tutorMessage.fromId, meId), isNull(tutorMessage.readAt)))
			.groupBy(other)
	]);
	return rows
		.map((r) => {
			const tp = tps.find((x) => x.id === r.otherId);
			return {
				otherId: r.otherId,
				otherName: tp?.name ?? names.find((x) => x.id === r.otherId)?.name ?? '',
				slug: tp?.slug ?? null,
				hasPhoto: !!tp?.photoKey,
				photoVersion: tp?.photoVersion ?? 0,
				last: r.body,
				lastAt: r.createdAt,
				lastFromMe: r.fromId === meId,
				unread: unread.find((u) => u.otherId === r.otherId)?.n ?? 0
			};
		})
		.sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
}

/** Unread messages for a student, per tutor. */
export async function unreadByTutor(db: DB, studentId: string) {
	const rows = await db
		.select({ tutorId: tutorMessage.tutorId, n: sql<number>`count(*)::int` })
		.from(tutorMessage)
		.where(
			and(
				eq(tutorMessage.studentId, studentId),
				ne(tutorMessage.fromId, studentId),
				isNull(tutorMessage.readAt)
			)
		)
		.groupBy(tutorMessage.tutorId);
	return new Map(rows.map((r) => [r.tutorId, r.n]));
}

/**
 * The messages of one conversation, oldest first. The viewer must be the student, the tutor
 * (still enrolled), or a parent allowed to read. Reading marks the other side's messages read
 * (a parent reading marks nothing). Returns null when the viewer may not see it.
 */
export async function thread(
	db: DB,
	viewer: { id: string; role: string },
	pair: { tutorId: string; studentId: string },
	limit = 100
) {
	const isParty = viewer.id === pair.tutorId || viewer.id === pair.studentId;
	let isEnrolled = true;
	if (isParty) {
		isEnrolled = await enrolled(db, pair.tutorId, pair.studentId);
		// a former tutor loses access; the student keeps the history
		if (!isEnrolled && viewer.id === pair.tutorId) return null;
	} else if (
		viewer.role !== 'parent' ||
		!(await readingParents(db, pair.studentId)).includes(viewer.id)
	)
		return null;
	const where = and(
		eq(tutorMessage.tutorId, pair.tutorId),
		eq(tutorMessage.studentId, pair.studentId)
	);
	const rows = await db
		.select({
			id: tutorMessage.id,
			fromId: tutorMessage.fromId,
			body: tutorMessage.body,
			createdAt: tutorMessage.createdAt
		})
		.from(tutorMessage)
		.where(where)
		.orderBy(desc(tutorMessage.createdAt), desc(tutorMessage.id))
		.limit(limit);
	// not enrolled and nothing said before: there is no conversation
	if (!isEnrolled && !rows.length) return null;
	if (isParty)
		await db
			.update(tutorMessage)
			.set({ readAt: new Date() })
			.where(and(where, ne(tutorMessage.fromId, viewer.id), isNull(tutorMessage.readAt)));
	return rows.reverse();
}

/** Tutors a parent's child is enrolled with, for the parent's read-only list. */
export async function childConversations(db: DB, parentId: string, studentId: string) {
	if (!(await readingParents(db, studentId)).includes(parentId)) return null;
	return conversations(db, studentId, 'student');
}
