/**
 * The tutor's Students tab: one card per student (subjects, last and next lesson, status) and
 * a few insights. Only this tutor's own students and records; nothing is guessed.
 *   active   – a lesson in the last 30 days or one booked ahead
 *   pending  – no lesson yet (e.g. only a booking request waiting for the tutor)
 *   inactive – had lessons, but none in the last 30 days and none booked
 */
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { attendee, lesson, review, subject } from './db/app.schema.ts';
import { assessmentResult } from './db/v3.schema.ts';
import { listStudents } from './people.ts';
import { balances } from './billing.ts';
import { addDays, localDate } from '../tz.ts';

export type StudentStatus = 'active' | 'inactive' | 'pending';

export async function studentCards(db: DB, tutorId: string, q = '', now = new Date()) {
	const people = await listStudents(db, tutorId, q);
	const ids = people.map((p) => p.id);
	if (!ids.length) return { cards: [], insights: null };
	const [lessons, results, bal] = await Promise.all([
		db
			.select({
				userId: attendee.userId,
				startsAt: lesson.startsAt,
				endsAt: lesson.endsAt,
				subject: subject.name,
				attendance: attendee.attendance
			})
			.from(attendee)
			.innerJoin(lesson, eq(lesson.id, attendee.lessonId))
			.leftJoin(subject, eq(subject.id, lesson.subjectId))
			.where(
				and(
					eq(lesson.tutorId, tutorId),
					eq(lesson.status, 'scheduled'),
					eq(attendee.status, 'booked'),
					inArray(attendee.userId, ids)
				)
			),
		db
			.select({
				studentId: assessmentResult.studentId,
				score: assessmentResult.score,
				maxScore: assessmentResult.maxScore,
				takenOn: assessmentResult.takenOn
			})
			.from(assessmentResult)
			.where(and(eq(assessmentResult.tutorId, tutorId), inArray(assessmentResult.studentId, ids)))
			.orderBy(assessmentResult.takenOn, assessmentResult.id),
		balances(db, tutorId)
	]);
	const monthAgo = addDays(now, -30);
	const cards = people.map((p) => {
		const mine = lessons.filter((l) => l.userId === p.id);
		const past = mine.filter((l) => l.endsAt <= now).sort((a, b) => +b.startsAt - +a.startsAt);
		const ahead = mine.filter((l) => l.endsAt > now).sort((a, b) => +a.startsAt - +b.startsAt);
		// a new request from someone who already has lessons doesn't make them "pending" again
		const status: StudentStatus = !mine.length
			? 'pending'
			: ahead.length || (past[0] && past[0].startsAt >= monthAgo)
				? 'active'
				: 'inactive';
		const subjects = [...new Set(mine.map((l) => l.subject).filter((x): x is string => !!x))];
		const res = results.filter((r) => r.studentId === p.id);
		const pct = (xs: typeof res) =>
			xs.length
				? Math.round((100 * xs.reduce((a, r) => a + r.score / r.maxScore, 0)) / xs.length)
				: null;
		return {
			id: p.id,
			name: p.name,
			childName: p.childName,
			level: p.level,
			subjects,
			status,
			lastLesson: past[0]?.startsAt ?? null,
			nextLesson: ahead[0]?.startsAt ?? null,
			owed: bal.get(p.id)?.owed ?? 0,
			// marks with this tutor: latest three, and the first three (needs 4+ results)
			latestPct: pct(res.slice(-3)),
			firstPct: res.length >= 4 ? pct(res.slice(0, 3)) : null,
			canMessage: p.role === 'student'
		};
	});
	const withMarks = cards.filter((c) => c.latestPct !== null);
	const insights = {
		avgPct: withMarks.length
			? Math.round(withMarks.reduce((a, c) => a + c.latestPct!, 0) / withMarks.length)
			: null,
		// "on track": their latest marks with you average 60% or more
		onTrackPct: withMarks.length
			? Math.round((100 * withMarks.filter((c) => c.latestPct! >= 60).length) / withMarks.length)
			: null,
		// "improving": latest marks at least 5 points above their first ones
		improving: cards.filter(
			(c) => c.firstPct !== null && c.latestPct !== null && c.latestPct - c.firstPct >= 5
		).length
	};
	return { cards, insights };
}

export async function studentStats(db: DB, tutorId: string, now = new Date()) {
	const month = localDate(now).slice(0, 7);
	const [[active], [rating]] = await Promise.all([
		db
			.select({ n: sql<number>`count(distinct ${attendee.userId})::int` })
			.from(attendee)
			.innerJoin(lesson, eq(lesson.id, attendee.lessonId))
			.where(
				and(
					eq(lesson.tutorId, tutorId),
					eq(lesson.status, 'scheduled'),
					eq(attendee.status, 'booked'),
					sql`to_char(${lesson.startsAt} at time zone 'Africa/Harare', 'YYYY-MM') = ${month}`
				)
			),
		db
			.select({ avg: sql<number>`avg(${review.rating})::float`, n: sql<number>`count(*)::int` })
			.from(review)
			.where(and(eq(review.tutorId, tutorId), eq(review.hidden, false)))
	]);
	return {
		activeThisMonth: active?.n ?? 0,
		rating: rating && rating.n ? Math.round(rating.avg * 10) / 10 : null,
		reviews: rating?.n ?? 0
	};
}
