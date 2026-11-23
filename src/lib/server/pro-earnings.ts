/**
 * Tutora Pro reports for the tutor: income per student, the earnings report (PDF and CSV),
 * and student insights (who is falling behind, attendance patterns).
 */
import { and, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { user } from './db/auth.schema.ts';
import { attendee, homework, homeworkAnswer, lesson, payment } from './db/app.schema.ts';
import { assessmentResult } from './db/v3.schema.ts';
import { listStudents } from './people.ts';
import { addDays, localDate, startOfLocalDay } from '../tz.ts';

type Currency = 'USD' | 'ZWG';

/** Confirmed payments per student in [from, to), biggest first (tutor's currency). */
export async function incomeByStudent(
	db: DB,
	tutorId: string,
	currency: Currency,
	from: Date,
	to: Date
) {
	const rows = await db
		.select({
			id: payment.userId,
			name: user.name,
			total: sql<number>`sum(${payment.amountCents})::int`,
			count: sql<number>`count(*)::int`
		})
		.from(payment)
		.innerJoin(user, eq(user.id, payment.userId))
		.where(
			and(
				eq(payment.tutorId, tutorId),
				eq(payment.status, 'confirmed'),
				eq(payment.currency, currency),
				gte(payment.decidedAt, from),
				lt(payment.decidedAt, to)
			)
		)
		.groupBy(payment.userId, user.name)
		.orderBy(desc(sql`sum(${payment.amountCents})`));
	return rows;
}

/* ------------------------------------------------------------------ insights */

export interface StudentInsight {
	id: string;
	name: string;
	lessons: number;
	attended: number;
	missed: number;
	/** share of marked lessons attended, 0–100, null when none marked */
	attendancePct: number | null;
	homeworkSet: number;
	homeworkMissing: number;
	homeworkLate: number;
	/** average score of the last 4 weeks and the 4 weeks before (percent), null if none */
	scoreNow: number | null;
	scoreBefore: number | null;
	/** weekday (0 = Sunday) the student misses most, when there is a pattern */
	missedDay: number | null;
	reasons: ('missed' | 'homework' | 'scores')[];
	behind: boolean;
}

/**
 * Who is falling behind, from the last 8 weeks: lessons missed (2 or more, or under 75%
 * attended), homework missing or late (2 or more), scores falling by 10 points or more.
 */
export async function studentInsights(
	db: DB,
	tutorId: string,
	now = new Date()
): Promise<StudentInsight[]> {
	const students = await listStudents(db, tutorId);
	if (!students.length) return [];
	const ids = students.map((s) => s.id);
	const from = addDays(startOfLocalDay(now), -56);
	const mid = addDays(startOfLocalDay(now), -28);
	const today = localDate(now);
	const [att, hw, scores] = await Promise.all([
		db
			.select({
				userId: attendee.userId,
				attendance: attendee.attendance,
				startsAt: lesson.startsAt
			})
			.from(attendee)
			.innerJoin(lesson, eq(lesson.id, attendee.lessonId))
			.where(
				and(
					eq(lesson.tutorId, tutorId),
					eq(lesson.status, 'scheduled'),
					eq(attendee.status, 'booked'),
					inArray(attendee.userId, ids),
					gte(lesson.startsAt, from),
					lt(lesson.endsAt, now)
				)
			),
		db
			.select({
				userId: homework.userId,
				dueOn: homework.dueOn,
				answeredAt: sql<
					number | null
				>`(extract(epoch from min(${homeworkAnswer.createdAt})) * 1000)::float8`
			})
			.from(homework)
			.leftJoin(homeworkAnswer, eq(homeworkAnswer.homeworkId, homework.id))
			.where(
				and(
					eq(homework.tutorId, tutorId),
					inArray(homework.userId, ids),
					gte(homework.createdAt, from)
				)
			)
			.groupBy(homework.id, homework.userId, homework.dueOn),
		db
			.select({
				studentId: assessmentResult.studentId,
				takenOn: assessmentResult.takenOn,
				score: assessmentResult.score,
				maxScore: assessmentResult.maxScore
			})
			.from(assessmentResult)
			.where(
				and(
					eq(assessmentResult.tutorId, tutorId),
					inArray(assessmentResult.studentId, ids),
					gte(assessmentResult.takenOn, localDate(from))
				)
			)
	]);
	const midDay = localDate(mid);
	return students
		.map((s) => {
			const mine = att.filter((a) => a.userId === s.id);
			const marked = mine.filter((a) => a.attendance);
			const missedL = marked.filter((a) => a.attendance === 'absent');
			const attended = marked.length - missedL.length;
			const days = new Map<number, number>();
			for (const a of missedL) {
				// Zimbabwe time (UTC+2, no summer time)
				const d = new Date(new Date(a.startsAt).getTime() + 2 * 3_600_000).getUTCDay();
				days.set(d, (days.get(d) ?? 0) + 1);
			}
			let missedDay: number | null = null;
			for (const [d, n] of days)
				if (n >= 2 && (missedDay === null || n > days.get(missedDay)!)) missedDay = d;
			const h = hw.filter((x) => x.userId === s.id);
			const due = h.filter((x) => x.dueOn && x.dueOn < today);
			const missing = due.filter((x) => !x.answeredAt).length;
			const late = h.filter(
				(x) => x.dueOn && x.answeredAt && localDate(new Date(Number(x.answeredAt))) > x.dueOn
			).length;
			const sc = scores.filter((x) => x.studentId === s.id);
			const avg = (rows: typeof sc) =>
				rows.length
					? Math.round((100 * rows.reduce((a, r) => a + r.score / r.maxScore, 0)) / rows.length)
					: null;
			const scoreNow = avg(sc.filter((x) => x.takenOn >= midDay));
			const scoreBefore = avg(sc.filter((x) => x.takenOn < midDay));
			const attendancePct = marked.length ? Math.round((100 * attended) / marked.length) : null;
			const reasons: StudentInsight['reasons'] = [];
			if (
				missedL.length >= 2 ||
				(attendancePct !== null && marked.length >= 3 && attendancePct < 75)
			)
				reasons.push('missed');
			if (missing + late >= 2) reasons.push('homework');
			if (scoreNow !== null && scoreBefore !== null && scoreBefore - scoreNow >= 10)
				reasons.push('scores');
			return {
				id: s.id,
				name: s.name,
				lessons: mine.length,
				attended,
				missed: missedL.length,
				attendancePct,
				homeworkSet: h.length,
				homeworkMissing: missing,
				homeworkLate: late,
				scoreNow,
				scoreBefore,
				missedDay,
				reasons,
				behind: reasons.length > 0
			};
		})
		.sort(
			(a, b) =>
				Number(b.behind) - Number(a.behind) ||
				b.reasons.length - a.reasons.length ||
				a.name.localeCompare(b.name)
		);
}
