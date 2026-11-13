/**
 * "You and your tutor": what a student and one tutor have done together, from real records
 * only: how long, lessons done, paid lessons, homework, and how marks moved.
 */
import { and, asc, eq, sql } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { attendee, charge, enrollment, homework, homeworkAnswer, lesson } from './db/app.schema.ts';
import { assessmentResult } from './db/v3.schema.ts';

const rowsOf = <T>(r: unknown) => ((r as { rows?: T[] }).rows ?? (r as T[])) as T[];

export async function together(db: DB, studentId: string, tutorId: string, now = new Date()) {
	const [enr] = await db
		.select({ createdAt: enrollment.createdAt })
		.from(enrollment)
		.where(and(eq(enrollment.tutorId, tutorId), eq(enrollment.userId, studentId)));
	const [lessons, paid, hw, results] = await Promise.all([
		db
			.select({ startsAt: lesson.startsAt, endsAt: lesson.endsAt, attendance: attendee.attendance })
			.from(attendee)
			.innerJoin(lesson, eq(lesson.id, attendee.lessonId))
			.where(
				and(
					eq(attendee.userId, studentId),
					eq(attendee.status, 'booked'),
					eq(lesson.tutorId, tutorId),
					eq(lesson.status, 'scheduled')
				)
			)
			.orderBy(asc(lesson.startsAt)),
		// lesson charges fully covered by confirmed payments
		db.execute(sql`
			select count(*) filter (where coalesce(p.paid, 0) >= c.amount_cents)::int as paid,
			       count(*)::int as charged
			from ${charge} c
			left join (
				select pa.charge_id, sum(pa.amount_cents) as paid
				from payment_allocation pa join payment p on p.id = pa.payment_id
				where p.status = 'confirmed'
				group by pa.charge_id
			) p on p.charge_id = c.id
			where c.user_id = ${studentId} and c.tutor_id = ${tutorId}
			  and c.kind = 'lesson' and not c.voided`),
		db
			.select({
				set: sql<number>`count(distinct ${homework.id})::int`,
				handed: sql<number>`count(distinct ${homeworkAnswer.homeworkId})::int`
			})
			.from(homework)
			.leftJoin(homeworkAnswer, eq(homeworkAnswer.homeworkId, homework.id))
			.where(and(eq(homework.userId, studentId), eq(homework.tutorId, tutorId))),
		db
			.select({
				score: assessmentResult.score,
				maxScore: assessmentResult.maxScore,
				topic: assessmentResult.topic
			})
			.from(assessmentResult)
			.where(and(eq(assessmentResult.studentId, studentId), eq(assessmentResult.tutorId, tutorId)))
			.orderBy(asc(assessmentResult.takenOn), asc(assessmentResult.id))
	]);
	if (!enr && !lessons.length) return null;
	const done = lessons.filter(
		(l) => l.endsAt.getTime() < now.getTime() && l.attendance !== 'absent'
	);
	const since = enr?.createdAt ?? lessons[0]?.startsAt ?? null;
	const months = since
		? Math.max(0, Math.floor((now.getTime() - since.getTime()) / (30.44 * 86_400_000)))
		: 0;
	const pct = (xs: typeof results) =>
		xs.length
			? Math.round((100 * xs.reduce((a, r) => a + r.score / r.maxScore, 0)) / xs.length)
			: null;
	// marks then and now: the first and the latest three results with this tutor (needs 4+)
	const marks =
		results.length >= 4
			? { first: pct(results.slice(0, 3)), latest: pct(results.slice(-3)) }
			: null;
	const p = rowsOf<{ paid: number; charged: number }>(paid)[0];
	const h = hw[0];
	return {
		since,
		months,
		lessonsDone: done.length,
		upcoming: lessons.filter((l) => l.endsAt.getTime() >= now.getTime()).length,
		paidLessons: p?.paid ?? 0,
		chargedLessons: p?.charged ?? 0,
		homework: { set: h?.set ?? 0, handed: h?.handed ?? 0 },
		results: results.length,
		topics: new Set(results.map((r) => r.topic.toLowerCase())).size,
		marks
	};
}
