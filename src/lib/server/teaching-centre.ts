/**
 * The tutor's More page ("my teaching centre"): their impact on students and their own growth
 * as a teacher. Every number comes from their own records; achievements say exactly what they
 * count, and nothing is invented.
 */
import { and, eq, gte, isNotNull, sql } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import {
	attendee,
	availability,
	homework,
	homeworkAnswer,
	lesson,
	review
} from './db/app.schema.ts';
import { dayTick, personalTask } from './db/personal.schema.ts';
import { addDays, localDate, startOfLocalWeek } from '../tz.ts';
import { studentCards } from './tutor-students.ts';

const rowsOf = <T>(r: unknown) => ((r as { rows?: T[] }).rows ?? (r as T[])) as T[];

export interface Achievement {
	key: string;
	earned: boolean;
	/** values for the message (e.g. n weeks) */
	n: number;
	/** what it takes, when not earned yet */
	target?: number;
}

export async function teachingCentre(db: DB, tutorId: string, now = new Date()) {
	const since = addDays(now, -365);
	const [weeksRes, doneRes, days, reviews, marking, ticks, tasks, { cards }] = await Promise.all([
		// weeks (Monday dates) with at least one lesson taught, last year
		db.execute(sql`
			select distinct to_char(date_trunc('week', (l.starts_at at time zone 'Africa/Harare')), 'YYYY-MM-DD') as w
			from ${lesson} l join ${attendee} a on a.lesson_id = l.id
			where l.tutor_id = ${tutorId} and l.status = 'scheduled' and a.status = 'booked'
			  and l.ends_at < ${now} and l.starts_at >= ${since}
			  and coalesce(a.attendance, 'completed') <> 'absent'`),
		db.execute(sql`
			select count(distinct l.id)::int as n
			from ${lesson} l join ${attendee} a on a.lesson_id = l.id
			where l.tutor_id = ${tutorId} and l.status = 'scheduled' and a.status = 'booked'
			  and l.ends_at < ${now} and coalesce(a.attendance, 'completed') <> 'absent'`),
		db
			.selectDistinct({ weekday: availability.weekday })
			.from(availability)
			.where(eq(availability.tutorId, tutorId)),
		db
			.select({ rating: review.rating, text: review.text, name: review.displayName })
			.from(review)
			.where(and(eq(review.tutorId, tutorId), eq(review.hidden, false)))
			.orderBy(sql`${review.createdAt} desc`),
		// homework marked in the last 60 days, and how quickly
		db
			.select({ handed: homeworkAnswer.createdAt, checked: homeworkAnswer.checkedAt })
			.from(homeworkAnswer)
			.innerJoin(homework, eq(homework.id, homeworkAnswer.homeworkId))
			.where(
				and(
					eq(homework.tutorId, tutorId),
					isNotNull(homeworkAnswer.checkedAt),
					gte(homeworkAnswer.createdAt, addDays(now, -60))
				)
			),
		// personal planner: tasks ticked in the last 14 days
		db
			.select({ n: sql<number>`count(*)::int` })
			.from(dayTick)
			.where(
				and(
					eq(dayTick.studentId, tutorId),
					gte(dayTick.onDate, localDate(addDays(now, -14))),
					sql`${dayTick.itemKey} like 't%'`
				)
			),
		db
			.select({ n: sql<number>`count(*)::int` })
			.from(personalTask)
			.where(and(eq(personalTask.studentId, tutorId), eq(personalTask.active, true))),
		studentCards(db, tutorId, '', now)
	]);
	const weeks = new Set(rowsOf<{ w: string }>(weeksRes).map((x) => x.w));
	// weeks in a row with lessons, ending this week or last week
	let streak = 0;
	let w = startOfLocalWeek(now);
	if (!weeks.has(localDate(w))) w = addDays(w, -7);
	while (weeks.has(localDate(w))) {
		streak++;
		w = addDays(w, -7);
	}
	const lessonsDone = rowsOf<{ n: number }>(doneRes)[0]?.n ?? 0;
	const good = reviews.filter((r) => r.rating >= 4);
	const markedOnTime = marking.filter(
		(x) => x.checked && x.checked.getTime() - x.handed.getTime() <= 2 * 86_400_000
	).length;
	const milestone = [100, 50, 25, 10].find((x) => lessonsDone >= x) ?? 0;
	const nextMilestone = [10, 25, 50, 100, 250].find((x) => lessonsDone < x) ?? 0;
	const achievements: Achievement[] = [
		{ key: 'consistency', earned: streak >= 2, n: streak, target: 2 },
		{
			key: 'milestone',
			earned: milestone > 0,
			n: milestone || nextMilestone,
			target: nextMilestone
		},
		{ key: 'routine', earned: days.length >= 3, n: days.length, target: 3 },
		{
			key: 'marking',
			earned: marking.length >= 3 && markedOnTime / marking.length >= 0.8,
			n: marking.length ? Math.round((100 * markedOnTime) / marking.length) : 0,
			target: 80
		},
		{ key: 'tasks', earned: (ticks[0]?.n ?? 0) >= 10, n: ticks[0]?.n ?? 0, target: 10 },
		{ key: 'reviews', earned: good.length >= 1, n: good.length, target: 1 }
	];
	// students whose marks with this tutor went up (first three vs latest three results)
	const improved = cards
		.filter((c) => c.firstPct !== null && c.latestPct !== null && c.latestPct > c.firstPct)
		.map((c) => ({
			id: c.id,
			name: c.name,
			subjects: c.subjects,
			first: c.firstPct!,
			latest: c.latestPct!
		}))
		.sort((a, b) => b.latest - b.first - (a.latest - a.first))
		.slice(0, 3);
	return {
		lessonsDone,
		streak,
		rating: reviews.length
			? Math.round((10 * reviews.reduce((a, r) => a + r.rating, 0)) / reviews.length) / 10
			: null,
		reviewCount: reviews.length,
		feedback: good.slice(0, 2).map((r) => ({ name: r.name, text: r.text, rating: r.rating })),
		achievements,
		improved,
		students: cards.length,
		hasTasks: (tasks[0]?.n ?? 0) > 0
	};
}
