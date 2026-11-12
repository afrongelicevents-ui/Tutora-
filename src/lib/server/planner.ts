/**
 * The daily personal planner and the personal report: the child's own day (school, study,
 * meals, rest, chores and personal tasks, each with a time), ticks during the day, weekly
 * personal goals, and summaries. Wellbeing and organisation only; never school marks.
 */
import { and, asc, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { user } from './db/auth.schema.ts';
import { checkin, studyPlanItem, studySession } from './db/v3.schema.ts';
import { personalActivity, type ActivityKind } from './db/schedule.schema.ts';
import {
	dayTick,
	goalTick,
	personalGoal,
	personalPref,
	personalTask,
	plannerReminderSent
} from './db/personal.schema.ts';
import type { Notify } from './notify-core.ts';
import { addDays, fromLocal, local, localDate, startOfLocalWeek } from '../tz.ts';
import { MOOD_LEVEL, type Mood } from '../checkin-copy.ts';
import { m } from '../paraglide/messages.js';

export const TASK_MAX = 40;
export const GOAL_MAX = 10;
/** A day counts as "followed" when at least this share of its plan was done. */
export const FOLLOWED_PCT = 60;

export interface PlanItem {
	key: string;
	kind: ActivityKind | 'task';
	title: string | null;
	subject: string | null;
	start: number | null;
	end: number | null;
	done: boolean;
	/** sleep is on the plan but isn't ticked off during the day */
	tickable: boolean;
	/** the task / activity id (for removing a task) */
	id: number | null;
}

export interface DayStats {
	date: string;
	planned: number;
	done: number;
	pct: number | null;
	tasksTotal: number;
	tasksDone: number;
}

const weekdayOf = (date: string) => new Date(date + 'T12:00:00Z').getUTCDay();
const endOf = (date: string) => fromLocal(date, 1440);

/** Everything on the plan for each date, with what was done. */
export async function itemsFor(db: DB, studentId: string, dates: string[]) {
	const out = new Map<string, PlanItem[]>();
	if (!dates.length) return out;
	const sorted = [...dates].sort();
	const first = sorted[0];
	const last = sorted.at(-1)!;
	const [acts, slots, tasks, ticks, sessions] = await Promise.all([
		db
			.select()
			.from(personalActivity)
			.where(and(eq(personalActivity.studentId, studentId), eq(personalActivity.active, true))),
		db
			.select()
			.from(studyPlanItem)
			.where(and(eq(studyPlanItem.studentId, studentId), eq(studyPlanItem.active, true))),
		db
			.select()
			.from(personalTask)
			.where(
				and(
					eq(personalTask.studentId, studentId),
					eq(personalTask.active, true),
					or(
						isNull(personalTask.onDate),
						and(gte(personalTask.onDate, first), lte(personalTask.onDate, last))
					)
				)
			),
		db
			.select({ onDate: dayTick.onDate, itemKey: dayTick.itemKey })
			.from(dayTick)
			.where(
				and(eq(dayTick.studentId, studentId), gte(dayTick.onDate, first), lte(dayTick.onDate, last))
			),
		db
			.select({ planItemId: studySession.planItemId, startedAt: studySession.startedAt })
			.from(studySession)
			.where(
				and(
					eq(studySession.studentId, studentId),
					eq(studySession.status, 'done'),
					gte(studySession.startedAt, fromLocal(first)),
					lte(studySession.startedAt, endOf(last))
				)
			)
	]);
	for (const date of dates) {
		const wd = weekdayOf(date);
		const end = endOf(date);
		const ticked = new Set(ticks.filter((t) => t.onDate === date).map((t) => t.itemKey));
		const items: PlanItem[] = [];
		for (const a of acts)
			if (a.days.includes(wd) && a.createdAt < end)
				items.push({
					key: `a${a.id}`,
					kind: a.kind,
					title: a.label,
					subject: null,
					start: a.startMinute,
					end: a.endMinute,
					done: ticked.has(`a${a.id}`),
					tickable: a.kind !== 'sleep',
					id: a.id
				});
		for (const p of slots)
			if (p.weekday === wd && p.createdAt < end)
				items.push({
					key: `p${p.id}`,
					kind: 'study',
					title: p.topic,
					subject: p.subject,
					start: p.startMinute,
					end: Math.min(1440, p.startMinute + p.minutes),
					done:
						ticked.has(`p${p.id}`) ||
						sessions.some((s) => s.planItemId === p.id && localDate(s.startedAt) === date),
					tickable: true,
					id: null
				});
		for (const t of tasks)
			if ((t.onDate ? t.onDate === date : (t.days ?? []).includes(wd)) && t.createdAt < end)
				items.push({
					key: `t${t.id}`,
					kind: 'task',
					title: t.title,
					subject: null,
					start: t.minute,
					end: null,
					done: ticked.has(`t${t.id}`),
					tickable: true,
					id: t.id
				});
		items.sort((x, y) => (x.start ?? 1441) - (y.start ?? 1441));
		out.set(date, items);
	}
	return out;
}

export function statsOf(date: string, items: PlanItem[]): DayStats {
	const counted = items.filter((i) => i.tickable);
	const done = counted.filter((i) => i.done).length;
	const tasks = items.filter((i) => i.kind === 'task');
	return {
		date,
		planned: counted.length,
		done,
		pct: counted.length ? Math.round((100 * done) / counted.length) : null,
		tasksTotal: tasks.length,
		tasksDone: tasks.filter((i) => i.done).length
	};
}

export async function today(db: DB, studentId: string, now = new Date()) {
	const date = localDate(now);
	const items = (await itemsFor(db, studentId, [date])).get(date) ?? [];
	return { date, items, stats: statsOf(date, items) };
}

/** Tick (or untick) something on today's plan. Only the student's own items for today. */
export async function tickItem(
	db: DB,
	studentId: string,
	key: string,
	done: boolean,
	now = new Date()
) {
	const t = await today(db, studentId, now);
	const item = t.items.find((i) => i.key === key);
	if (!item || !item.tickable) return false;
	if (done)
		await db
			.insert(dayTick)
			.values({ studentId, onDate: t.date, itemKey: key })
			.onConflictDoNothing();
	else
		await db
			.delete(dayTick)
			.where(
				and(eq(dayTick.studentId, studentId), eq(dayTick.onDate, t.date), eq(dayTick.itemKey, key))
			);
	return true;
}

/* ------------------------------------------------------------------ tasks */

export async function addTask(
	db: DB,
	studentId: string,
	v: { title: string; minute: number | null; days: number[]; onlyToday: boolean },
	now = new Date()
): Promise<{ ok: true } | { ok: false; error: string }> {
	const title = v.title.trim().replace(/\s+/g, ' ').slice(0, 60);
	if (!title) return { ok: false, error: 'pl_err_title' };
	if (v.minute !== null && !(v.minute >= 0 && v.minute < 1440))
		return { ok: false, error: 'ps_err_time' };
	const days = [...new Set(v.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))];
	if (!v.onlyToday && !days.length) return { ok: false, error: 'ps_err_days' };
	const n = (
		await db
			.select({ id: personalTask.id })
			.from(personalTask)
			.where(and(eq(personalTask.studentId, studentId), eq(personalTask.active, true)))
	).length;
	if (n >= TASK_MAX) return { ok: false, error: 'ps_err_many' };
	await db.insert(personalTask).values({
		studentId,
		title,
		minute: v.minute,
		days: v.onlyToday ? null : days,
		onDate: v.onlyToday ? localDate(now) : null
	});
	return { ok: true };
}

/** Removing keeps past days honest: the task stops from now on (history stays). */
export async function removeTask(db: DB, studentId: string, id: number) {
	await db
		.update(personalTask)
		.set({ active: false })
		.where(and(eq(personalTask.id, id), eq(personalTask.studentId, studentId)));
}

/* ------------------------------------------------------------------ weekly goals */

export async function addGoal(db: DB, studentId: string, title: string, targetDays: number) {
	const t = title.trim().replace(/\s+/g, ' ').slice(0, 60);
	if (!t) return { ok: false as const, error: 'pl_err_title' };
	if (!(Number.isInteger(targetDays) && targetDays >= 1 && targetDays <= 7))
		return { ok: false as const, error: 'pl_err_target' };
	const n = (
		await db
			.select({ id: personalGoal.id })
			.from(personalGoal)
			.where(and(eq(personalGoal.studentId, studentId), eq(personalGoal.active, true)))
	).length;
	if (n >= GOAL_MAX) return { ok: false as const, error: 'ps_err_many' };
	await db.insert(personalGoal).values({ studentId, title: t, targetDays });
	return { ok: true as const };
}

export async function removeGoal(db: DB, studentId: string, id: number) {
	await db
		.update(personalGoal)
		.set({ active: false })
		.where(and(eq(personalGoal.id, id), eq(personalGoal.studentId, studentId)));
}

/** "I kept this goal today" (or undo). Only the student's own active goals, only today. */
export async function tickGoal(
	db: DB,
	studentId: string,
	goalId: number,
	done: boolean,
	now = new Date()
) {
	const [g] = await db
		.select({ id: personalGoal.id })
		.from(personalGoal)
		.where(
			and(
				eq(personalGoal.id, goalId),
				eq(personalGoal.studentId, studentId),
				eq(personalGoal.active, true)
			)
		);
	if (!g) return false;
	const date = localDate(now);
	if (done) await db.insert(goalTick).values({ goalId, onDate: date }).onConflictDoNothing();
	else await db.delete(goalTick).where(and(eq(goalTick.goalId, goalId), eq(goalTick.onDate, date)));
	return true;
}

const weekOf = (date: string) => localDate(startOfLocalWeek(new Date(date + 'T12:00:00Z')));

/** This week's goals with how many days are ticked; and all weekly goals ever reached. */
export async function goals(db: DB, studentId: string, now = new Date()) {
	const all = await db
		.select()
		.from(personalGoal)
		.where(eq(personalGoal.studentId, studentId))
		.orderBy(asc(personalGoal.id));
	const ticks = all.length
		? await db
				.select({ goalId: goalTick.goalId, onDate: goalTick.onDate })
				.from(goalTick)
				.where(
					inArray(
						goalTick.goalId,
						all.map((g) => g.id)
					)
				)
		: [];
	const thisWeek = localDate(startOfLocalWeek(now));
	const todayDate = localDate(now);
	// reached = a goal ticked on at least its target number of days in one week
	const perWeek = new Map<string, number>();
	for (const t of ticks) {
		const k = `${t.goalId}|${weekOf(t.onDate)}`;
		perWeek.set(k, (perWeek.get(k) ?? 0) + 1);
	}
	let reached = 0;
	let reachedThisWeek = 0;
	for (const [k, n] of perWeek) {
		const [gid, wk] = k.split('|');
		const g = all.find((x) => x.id === Number(gid));
		if (g && n >= g.targetDays) {
			reached++;
			if (wk === thisWeek) reachedThisWeek++;
		}
	}
	const active = all
		.filter((g) => g.active)
		.map((g) => {
			const mine = ticks.filter((t) => t.goalId === g.id && weekOf(t.onDate) === thisWeek);
			return {
				id: g.id,
				title: g.title,
				target: g.targetDays,
				count: mine.length,
				achieved: mine.length >= g.targetDays,
				today: mine.some((t) => t.onDate === todayDate)
			};
		});
	return { active, reached, reachedThisWeek };
}

/* ------------------------------------------------------------------ report */

/** Monday → today of this week, per day; plus days planned / followed and consistency. */
export async function weekStats(db: DB, studentId: string, now = new Date()) {
	const monday = startOfLocalWeek(now);
	const dates: string[] = [];
	for (let i = 0; i < 7; i++) dates.push(localDate(addDays(monday, i)));
	const todayDate = localDate(now);
	const sofar = dates.filter((d) => d <= todayDate);
	const items = await itemsFor(db, studentId, sofar);
	const days = dates.map((d) =>
		d <= todayDate ? statsOf(d, items.get(d) ?? []) : { ...statsOf(d, []), future: true }
	);
	const planned = days.filter((d) => d.planned > 0 && d.date <= todayDate);
	const followed = planned.filter((d) => (d.pct ?? 0) >= FOLLOWED_PCT);
	return {
		days,
		daysPlanned: planned.length,
		daysFollowed: followed.length,
		consistency: planned.length ? Math.round((100 * followed.length) / planned.length) : null,
		tasksDone: days.reduce((a, d) => a + d.tasksDone, 0)
	};
}

/** One plain-words line about this week, only from what really happened. */
export function personalInsight(
	w: Awaited<ReturnType<typeof weekStats>>,
	goalsReachedThisWeek: number
): { key: string; n?: number; day?: string } | null {
	if (goalsReachedThisWeek > 0) return { key: 'pr_ins_goals', n: goalsReachedThisWeek };
	if (w.daysFollowed >= 2) return { key: 'pr_ins_followed', n: w.daysFollowed };
	const best = [...w.days]
		.filter((d) => d.pct !== null && d.pct > 0)
		.sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))[0];
	if (best && w.daysPlanned >= 2) return { key: 'pr_ins_best', day: best.date };
	if (w.tasksDone > 0) return { key: 'pr_ins_tasks', n: w.tasksDone };
	if (w.daysPlanned === 0) return null;
	return { key: 'pr_ins_start' };
}

/** Past days (newest first) with plan vs done, tasks and the day's feelings. */
export async function personalHistory(
	db: DB,
	studentId: string,
	opts: { before?: string; days?: number } = {},
	now = new Date()
) {
	const span = opts.days ?? 14;
	const start = opts.before ? new Date(opts.before + 'T12:00:00Z') : now;
	const dates: string[] = [];
	for (let i = 1; i <= span; i++) dates.push(localDate(addDays(start, -i)));
	const [items, checks] = await Promise.all([
		itemsFor(db, studentId, dates),
		db
			.select({ mood: checkin.mood, kind: checkin.kind, createdAt: checkin.createdAt })
			.from(checkin)
			.where(
				and(
					eq(checkin.studentId, studentId),
					gte(checkin.createdAt, fromLocal(dates.at(-1)!)),
					lte(checkin.createdAt, endOf(dates[0]))
				)
			)
			.orderBy(asc(checkin.createdAt))
	]);
	const days = dates
		.map((d) => {
			const s = statsOf(d, items.get(d) ?? []);
			const c = checks.filter((x) => localDate(x.createdAt) === d);
			const start = c.find((x) => x.kind === 'start')?.mood ?? null;
			const end = c.filter((x) => x.kind === 'followup').at(-1)?.mood ?? null;
			return { ...s, startMood: start, endMood: end, ticked: s.done > 0 };
		})
		.filter((d) => d.planned > 0 || d.startMood || d.endMood);
	return { days, olderFrom: dates.at(-1)! };
}

/** The day's short summary line (message key), from the day's own numbers and feelings. */
export function daySummaryLine(
	s: DayStats,
	startMood: Mood | null,
	endMood: Mood | null
): { key: string; n?: number } {
	if (s.planned && s.done === s.planned) return { key: 'pr_day_all' };
	if (s.pct !== null && s.pct >= FOLLOWED_PCT) return { key: 'pr_day_followed', n: s.pct };
	if (startMood && endMood && MOOD_LEVEL[endMood] > MOOD_LEVEL[startMood])
		return { key: 'ds_line_better' };
	if (s.done > 0) return { key: 'pr_day_some', n: s.done };
	if (s.planned) return { key: 'pr_day_tomorrow' };
	return { key: 'pr_day_empty' };
}

/* ------------------------------------------------------------------ sharing */

export async function shareReport(db: DB, studentId: string) {
	const [p] = await db.select().from(personalPref).where(eq(personalPref.studentId, studentId));
	return p?.shareReport ?? false;
}

export async function setShareReport(db: DB, studentId: string, share: boolean) {
	await db
		.insert(personalPref)
		.values({ studentId, shareReport: share })
		.onConflictDoUpdate({
			target: personalPref.studentId,
			set: { shareReport: share, updatedAt: new Date() }
		});
}

/* ------------------------------------------------------------------ reminders */

const MORNING_FROM = 7 * 60;
const MORNING_TO = 10 * 60;

/** "Good morning! Plan your day": 7–10 AM, once a day, to students who use the planner. */
export async function sendPlannerMornings(db: DB, notify: Notify, now = new Date()) {
	const { minutes } = local(now);
	if (minutes < MORNING_FROM || minutes >= MORNING_TO) return 0;
	const [a, b, c] = await Promise.all([
		db.selectDistinct({ id: personalActivity.studentId }).from(personalActivity),
		db
			.selectDistinct({ id: personalTask.studentId })
			.from(personalTask)
			.where(eq(personalTask.active, true)),
		db
			.selectDistinct({ id: personalGoal.studentId })
			.from(personalGoal)
			.where(eq(personalGoal.active, true))
	]);
	const ids = [...new Set([...a, ...b, ...c].map((x) => x.id))];
	if (!ids.length) return 0;
	const students = await db
		.select({ id: user.id })
		.from(user)
		.where(and(inArray(user.id, ids), eq(user.role, 'student')));
	const date = localDate(now);
	let sent = 0;
	for (const s of students) {
		const claimed = await db
			.insert(plannerReminderSent)
			.values({ studentId: s.id, onDate: date })
			.onConflictDoNothing()
			.returning({ id: plannerReminderSent.studentId });
		if (!claimed.length) continue;
		await notify(s.id, m.pl_morning_s(), m.pl_morning_b(), {
			kind: 'reminder',
			link: '/student/planner'
		}).catch(() => {});
		sent++;
	}
	return sent;
}
