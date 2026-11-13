/**
 * The parent's view of one child. Everything goes through parentAccess(): a parent sees only
 * what that child shares (or, for a child under 18, what a guardian always sees). Private
 * messages, tutor notes and check-ins the child kept private are never read here.
 */
import { and, asc, desc, eq, gte, isNull, lte } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { homework, homeworkAnswer } from './db/app.schema.ts';
import { assessmentResult, studySession } from './db/v3.schema.ts';
import { user } from './db/auth.schema.ts';
import { parentAccess, type Access } from './family.ts';
import { sharedCheckins } from './checkins.ts';
import { examReadiness, overallProgress, weakTopics } from './progress.ts';
import { planFor, streak, todaysPlan, weekSummary } from './study.ts';
import { lessonsForUser } from './bookings.ts';
import { CLOSE_AFTER_MIN } from './room.ts';
import { addDays, fromLocal, local, localDate, startOfLocalDay } from '../tz.ts';
import { shortName } from '../names.ts';

export type Alert =
	| { kind: 'study_now'; subject: string; startMinute: number; endMinute: number }
	| { kind: 'study_later'; subject: string; startMinute: number; endMinute: number }
	| { kind: 'study_done'; subject: string; minutes: number; at: Date }
	| { kind: 'lesson_today'; subject: string | null; at: Date; mode: string };

export type Tip =
	| { kind: 'weak_planned'; topic: string }
	| { kind: 'weak'; topic: string }
	| { kind: 'hard' }
	| { kind: 'break' }
	| { kind: 'all_done'; done: number }
	| { kind: 'streak'; days: number }
	| { kind: 'homework'; title: string; dueOn: string }
	| { kind: 'exam'; title: string; days: number }
	| { kind: 'interest' };

/**
 * "How you can help": one encouraging, concrete suggestion from real activity, most useful
 * first. Only uses data this parent may see.
 */
export function chooseTip(v: {
	access: Access;
	weak: { topic: string } | null;
	weakPlanned: boolean;
	checkin: { mood: string } | null;
	week: { planned: number; done: number } | null;
	streak: number;
	homeworkDue: { title: string; dueOn: string } | null;
	exam: { title: string; daysLeft: number | null } | null;
}): Tip {
	if (v.checkin?.mood === 'need_break') return { kind: 'break' };
	if (v.checkin && (v.checkin.mood === 'finding_hard' || v.checkin.mood === 'need_help'))
		return { kind: 'hard' };
	if (v.access.progress && v.weak)
		return v.weakPlanned
			? { kind: 'weak_planned', topic: v.weak.topic }
			: { kind: 'weak', topic: v.weak.topic };
	if (v.access.study && v.week && v.week.planned > 0 && v.week.done >= v.week.planned)
		return { kind: 'all_done', done: v.week.done };
	if (v.access.homework && v.homeworkDue) return { kind: 'homework', ...v.homeworkDue };
	if (v.access.progress && v.exam && v.exam.daysLeft !== null && v.exam.daysLeft <= 30)
		return { kind: 'exam', title: v.exam.title, days: v.exam.daysLeft };
	if (v.access.study && v.streak >= 3) return { kind: 'streak', days: v.streak };
	return { kind: 'interest' };
}

/** Today's alert for one child, from the study plan, sessions and lessons they share. */
export async function todaysAlert(
	db: DB,
	studentId: string,
	access: Access,
	now = new Date()
): Promise<Alert | null> {
	if (access.study) {
		const plan = await todaysPlan(db, studentId, now);
		const nowSlot = plan.find((p) => p.state === 'now');
		if (nowSlot)
			return {
				kind: 'study_now',
				subject: nowSlot.subject,
				startMinute: nowSlot.startMinute,
				endMinute: nowSlot.startMinute + nowSlot.minutes
			};
		const [done] = await db
			.select()
			.from(studySession)
			.where(
				and(
					eq(studySession.studentId, studentId),
					eq(studySession.status, 'done'),
					gte(studySession.startedAt, startOfLocalDay(now))
				)
			)
			.orderBy(desc(studySession.endedAt))
			.limit(1);
		const later = plan.find((p) => p.state === 'next');
		if (done && (!later || local(now).minutes < later.startMinute - 90))
			return {
				kind: 'study_done',
				subject: done.subject,
				minutes: Math.max(
					1,
					Math.round(((done.endedAt ?? now).getTime() - done.startedAt.getTime()) / 60_000)
				),
				at: done.endedAt ?? now
			};
		if (later)
			return {
				kind: 'study_later',
				subject: later.subject,
				startMinute: later.startMinute,
				endMinute: later.startMinute + later.minutes
			};
	}
	if (access.lessons) {
		const today = localDate(now);
		const l = (await lessonsForUser(db, studentId)).find(
			(x) => localDate(x.startsAt) === today && x.endsAt.getTime() > now.getTime()
		);
		if (l) return { kind: 'lesson_today', subject: l.subjectName, at: l.startsAt, mode: l.mode };
	}
	return null;
}

async function homeworkDue(db: DB, studentId: string, now: Date) {
	const [h] = await db
		.select({ title: homework.title, dueOn: homework.dueOn })
		.from(homework)
		.leftJoin(homeworkAnswer, eq(homeworkAnswer.homeworkId, homework.id))
		.where(
			and(
				eq(homework.userId, studentId),
				isNull(homeworkAnswer.id),
				gte(homework.dueOn, localDate(now)),
				lte(homework.dueOn, localDate(addDays(now, 4)))
			)
		)
		.orderBy(asc(homework.dueOn))
		.limit(1);
	return h?.dueOn ? { title: h.title, dueOn: h.dueOn } : null;
}

/** Everything the overview shows for one child (nothing at all without access). */
export async function childOverview(db: DB, parentId: string, studentId: string, now = new Date()) {
	const access = await parentAccess(db, parentId, studentId);
	if (!access.ok) return null;
	const [u] = await db.select({ name: user.name }).from(user).where(eq(user.id, studentId));
	const [alert, checkins, week, days, overall, weak, exams, plan, lessons, due] = await Promise.all(
		[
			todaysAlert(db, studentId, access, now),
			sharedCheckins(db, studentId, addDays(now, -3), 1),
			access.study ? weekSummary(db, studentId, now) : null,
			access.study ? streak(db, studentId, now) : 0,
			access.progress ? overallProgress(db, studentId, now) : null,
			access.progress ? weakTopics(db, studentId, 1) : [],
			access.progress ? examReadiness(db, studentId, now) : [],
			access.study ? planFor(db, studentId) : [],
			access.lessons ? lessonsForUser(db, studentId) : [],
			access.homework ? homeworkDue(db, studentId, now) : null
		]
	);
	const upcoming = lessons.filter(
		(l) => l.endsAt.getTime() + CLOSE_AFTER_MIN * 60_000 > now.getTime()
	);
	const w = weak[0] ?? null;
	const checkin = checkins[0] ? { mood: checkins[0].mood, at: checkins[0].createdAt } : null;
	return {
		studentId,
		name: u?.name ?? '',
		firstName: shortName(u?.name ?? ''),
		access,
		alert,
		checkin,
		week,
		streak: days,
		overall: overall?.current?.pct ?? null,
		lessonsBooked: access.lessons ? upcoming.length : null,
		upcoming: upcoming.slice(0, 3).map((l) => ({
			id: l.id,
			subjectName: l.subjectName,
			tutorName: l.tutorName,
			startsAt: l.startsAt,
			mode: l.mode,
			address: l.address
		})),
		exams: exams.slice(0, 2),
		tip: chooseTip({
			access,
			weak: w,
			weakPlanned: !!w && plan.some((p) => (p.topic ?? '').toLowerCase() === w.topic.toLowerCase()),
			checkin,
			week,
			streak: days,
			homeworkDue: due,
			exam: exams[0] ? { title: exams[0].title, daysLeft: exams[0].daysLeft } : null
		})
	};
}

export type UpdateItem = {
	at: Date;
	kind:
		| 'study_started'
		| 'study_done'
		| 'check'
		| 'result'
		| 'homework_set'
		| 'homework_in'
		| 'lesson'
		| 'checkin';
	text: Record<string, string | number>;
	link?: string;
};

/** The child's recent activity this parent may see, newest first. */
export async function childUpdates(
	db: DB,
	parentId: string,
	studentId: string,
	now = new Date(),
	days = 14
) {
	const access = await parentAccess(db, parentId, studentId);
	if (!access.ok) return null;
	const since = addDays(now, -days);
	const out: UpdateItem[] = [];
	if (access.study) {
		const sessions = await db
			.select()
			.from(studySession)
			.where(and(eq(studySession.studentId, studentId), gte(studySession.startedAt, since)))
			.orderBy(desc(studySession.startedAt));
		for (const s of sessions) {
			if (s.status === 'done')
				out.push({
					at: s.endedAt ?? s.startedAt,
					kind: 'study_done',
					text: {
						subject: s.subject,
						minutes: Math.max(
							1,
							Math.round(((s.endedAt ?? s.startedAt).getTime() - s.startedAt.getTime()) / 60_000)
						)
					}
				});
			else if (s.status === 'running')
				out.push({
					at: s.startedAt,
					kind: 'study_started',
					text: { subject: s.subject, minutes: s.plannedMinutes }
				});
		}
	}
	if (access.progress) {
		const results = await db
			.select()
			.from(assessmentResult)
			.where(and(eq(assessmentResult.studentId, studentId), gte(assessmentResult.createdAt, since)))
			.orderBy(desc(assessmentResult.createdAt));
		for (const r of results)
			out.push({
				// when the work was done (marking can be later)
				at: r.takenOn < localDate(r.createdAt) ? fromLocal(r.takenOn, 12 * 60) : r.createdAt,
				kind: r.source === 'daily_check' ? 'check' : 'result',
				text: {
					title: r.title,
					topic: r.topic,
					subject: r.subject,
					score: r.score,
					max: r.maxScore
				}
			});
	}
	if (access.homework) {
		const hw = await db
			.select({
				id: homework.id,
				title: homework.title,
				dueOn: homework.dueOn,
				createdAt: homework.createdAt
			})
			.from(homework)
			.where(and(eq(homework.userId, studentId), gte(homework.createdAt, since)));
		for (const h of hw)
			out.push({
				at: h.createdAt,
				kind: 'homework_set',
				text: { title: h.title, due: h.dueOn ?? '' }
			});
		const answers = await db
			.select({ title: homework.title, at: homeworkAnswer.createdAt })
			.from(homeworkAnswer)
			.innerJoin(homework, eq(homework.id, homeworkAnswer.homeworkId))
			.where(and(eq(homework.userId, studentId), gte(homeworkAnswer.createdAt, since)));
		for (const a of answers) out.push({ at: a.at, kind: 'homework_in', text: { title: a.title } });
	}
	if (access.lessons) {
		const lessons = await lessonsForUser(db, studentId);
		for (const l of lessons.filter((x) => x.startsAt >= since && x.startsAt <= addDays(now, 7)))
			out.push({
				at: l.startsAt,
				kind: 'lesson',
				text: {
					subject: l.subjectName ?? '',
					tutor: l.tutorName ?? '',
					future: l.startsAt > now ? 1 : 0
				}
			});
	}
	for (const c of await sharedCheckins(db, studentId, since, 20))
		out.push({ at: c.createdAt, kind: 'checkin', text: { mood: c.mood } });
	out.sort((a, b) => b.at.getTime() - a.at.getTime());
	return out;
}

/** The weekly report for one child and one week (Monday start), from real records only. */
export async function weeklyReport(db: DB, parentId: string, studentId: string, weekStart: Date) {
	const access = await parentAccess(db, parentId, studentId);
	if (!access.ok) return null;
	const end = addDays(weekStart, 7);
	const [u] = await db.select({ name: user.name }).from(user).where(eq(user.id, studentId));
	const sessions = access.study
		? await db
				.select()
				.from(studySession)
				.where(
					and(
						eq(studySession.studentId, studentId),
						gte(studySession.startedAt, weekStart),
						lte(studySession.startedAt, end)
					)
				)
		: [];
	const results = access.progress
		? await db
				.select()
				.from(assessmentResult)
				.where(
					and(
						eq(assessmentResult.studentId, studentId),
						gte(assessmentResult.takenOn, localDate(weekStart)),
						lte(assessmentResult.takenOn, localDate(addDays(end, -1)))
					)
				)
		: [];
	const lessons = access.lessons
		? (await lessonsForUser(db, studentId)).filter(
				(l) => l.startsAt >= weekStart && l.startsAt < end
			)
		: [];
	const hw = access.homework
		? await db
				.select({ id: homework.id, title: homework.title })
				.from(homework)
				.where(
					and(
						eq(homework.userId, studentId),
						gte(homework.createdAt, weekStart),
						lte(homework.createdAt, end)
					)
				)
		: [];
	const plan = access.study ? await planFor(db, studentId) : [];
	const done = sessions.filter((s) => s.status === 'done');
	const minutes = done.reduce(
		(a, s) =>
			a + Math.round(((s.endedAt ?? s.startedAt).getTime() - s.startedAt.getTime()) / 60_000),
		0
	);
	const byTopic = new Map<string, { score: number; max: number }>();
	for (const r of results) {
		const k = `${r.subject} · ${r.topic}`;
		const v = byTopic.get(k) ?? { score: 0, max: 0 };
		v.score += r.score;
		v.max += r.maxScore;
		byTopic.set(k, v);
	}
	return {
		name: shortName(u?.name ?? ''),
		access,
		weekStart: localDate(weekStart),
		sessionsDone: done.length,
		// only the plan slots that already existed by the end of that week
		sessionsPlanned: plan.filter((p) => p.createdAt < end).length,
		minutes,
		topics: [...byTopic.entries()].map(([topic, v]) => ({
			topic,
			pct: Math.round((100 * v.score) / v.max)
		})),
		checks: results.filter((r) => r.source === 'daily_check').length,
		lessons: lessons.length,
		homeworkSet: hw.length,
		checkins: (await sharedCheckins(db, studentId, weekStart, 50, new Date(), end)).map(
			(c) => c.mood
		)
	};
}
