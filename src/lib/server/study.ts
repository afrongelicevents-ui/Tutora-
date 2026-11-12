/**
 * Study accountability: a weekly plan, focus sessions, streaks and the week's numbers.
 * Everything is counted from the student's own plan and sessions.
 */
import { shortName } from '../names.ts';
import { and, asc, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { assessmentResult, studyPlanItem, studySession } from './db/v3.schema.ts';
import { addDays, local, localDate, startOfLocalDay, startOfLocalWeek } from '../tz.ts';
import { user } from './db/auth.schema.ts';
import { parentsWhoSee } from './family.ts';
import type { Notify } from './notify-core.ts';
import { m } from '../paraglide/messages.js';

export type SlotState = 'done' | 'now' | 'next' | 'later' | 'missed';

export interface TodaySlot {
	id: number;
	startMinute: number;
	minutes: number;
	subject: string;
	topic: string | null;
	state: SlotState;
	sessionId: number | null;
}

export const planFor = (db: DB, studentId: string) =>
	db
		.select()
		.from(studyPlanItem)
		.where(and(eq(studyPlanItem.studentId, studentId), eq(studyPlanItem.active, true)))
		.orderBy(asc(studyPlanItem.weekday), asc(studyPlanItem.startMinute));

/** Today's plan with done / now / next / later / missed, from the plan and today's sessions. */
export async function todaysPlan(
	db: DB,
	studentId: string,
	now = new Date()
): Promise<TodaySlot[]> {
	const { weekday, minutes } = local(now);
	const items = (await planFor(db, studentId)).filter((i) => i.weekday === weekday);
	if (!items.length) return [];
	const sessions = await db
		.select()
		.from(studySession)
		.where(
			and(
				eq(studySession.studentId, studentId),
				gte(studySession.startedAt, startOfLocalDay(now)),
				inArray(
					studySession.planItemId,
					items.map((i) => i.id)
				)
			)
		);
	let nextGiven = false;
	return items.map((i) => {
		const s = sessions.find((x) => x.planItemId === i.id && x.status !== 'stopped');
		let state: SlotState;
		if (s?.status === 'done') state = 'done';
		else if (s?.status === 'running') state = 'now';
		else if (minutes >= i.startMinute && minutes < i.startMinute + i.minutes) state = 'now';
		else if (minutes >= i.startMinute + i.minutes) state = 'missed';
		else if (!nextGiven) {
			state = 'next';
			nextGiven = true;
		} else state = 'later';
		if (state === 'now') nextGiven = true;
		return {
			id: i.id,
			startMinute: i.startMinute,
			minutes: i.minutes,
			subject: i.subject,
			topic: i.topic,
			state,
			sessionId: s?.id ?? null
		};
	});
}

export async function runningSession(db: DB, studentId: string) {
	const [s] = await db
		.select()
		.from(studySession)
		.where(and(eq(studySession.studentId, studentId), eq(studySession.status, 'running')))
		.orderBy(desc(studySession.startedAt))
		.limit(1);
	return s ?? null;
}

/** Start a focus session (one at a time: a running one is stopped first). */
export async function startSession(
	db: DB,
	studentId: string,
	v: { planItemId?: number | null; subject: string; topic?: string | null; minutes: number },
	now = new Date()
) {
	let { subject, topic } = v;
	let planItemId: number | null = null;
	let minutes = Math.min(240, Math.max(5, Math.round(v.minutes || 25)));
	if (v.planItemId) {
		const [item] = await db
			.select()
			.from(studyPlanItem)
			.where(and(eq(studyPlanItem.id, v.planItemId), eq(studyPlanItem.studentId, studentId)));
		if (item) {
			planItemId = item.id;
			subject = item.subject;
			topic = item.topic;
			minutes = item.minutes;
		}
	}
	subject = subject.trim().slice(0, 60);
	if (!subject) return null;
	return db.transaction(async (tx) => {
		await tx
			.update(studySession)
			.set({ status: 'stopped', endedAt: now })
			.where(and(eq(studySession.studentId, studentId), eq(studySession.status, 'running')));
		const [row] = await tx
			.insert(studySession)
			.values({
				studentId,
				planItemId,
				subject,
				topic: topic?.trim().slice(0, 80) || null,
				plannedMinutes: minutes,
				startedAt: now
			})
			.returning();
		return row;
	});
}

/** Finish (done) or stop (didn't finish) the student's own running session. */
export async function endSession(
	db: DB,
	studentId: string,
	id: number,
	done: boolean,
	now = new Date()
) {
	const [row] = await db
		.update(studySession)
		.set({ status: done ? 'done' : 'stopped', endedAt: now })
		.where(
			and(
				eq(studySession.id, id),
				eq(studySession.studentId, studentId),
				eq(studySession.status, 'running')
			)
		)
		.returning();
	return row ?? null;
}

/** Days (Zimbabwe dates) with at least one finished session or daily knowledge check. */
async function activeDays(db: DB, studentId: string, since: Date) {
	const r = await db.execute(sql`
		select distinct to_char((started_at at time zone 'Africa/Harare')::date, 'YYYY-MM-DD') as d
		from ${studySession}
		where student_id = ${studentId} and status = 'done' and started_at >= ${since}
		union
		select distinct to_char(taken_on, 'YYYY-MM-DD') as d
		from ${assessmentResult}
		where student_id = ${studentId} and source = 'daily_check' and taken_on >= ${localDate(since)}`);
	const rows = ((r as unknown as { rows?: { d: string }[] }).rows ??
		(r as unknown as { d: string }[])) as { d: string }[];
	return new Set(rows.map((x) => x.d));
}

/**
 * Streak: days in a row with a finished session or daily check, counting back from today
 * (today still counts as "in progress": a streak isn't lost until a whole day is missed).
 */
export async function streak(db: DB, studentId: string, now = new Date()) {
	const days = await activeDays(db, studentId, addDays(startOfLocalDay(now), -120));
	let n = 0;
	let d = startOfLocalDay(now);
	if (!days.has(localDate(d))) d = addDays(d, -1);
	while (days.has(localDate(d))) {
		n++;
		d = addDays(d, -1);
	}
	return n;
}

/** This week (Monday to Sunday): planned slots so far and sessions finished. */
export async function weekSummary(db: DB, studentId: string, now = new Date()) {
	const weekStart = startOfLocalWeek(now);
	const plan = await planFor(db, studentId);
	// slots planned for the whole week
	const planned = plan.length;
	const [done] = await db
		.select({
			n: sql<number>`count(*)::int`,
			minutes: sql<number>`coalesce(sum(extract(epoch from (${studySession.endedAt} - ${studySession.startedAt})) / 60), 0)::int`
		})
		.from(studySession)
		.where(
			and(
				eq(studySession.studentId, studentId),
				eq(studySession.status, 'done'),
				gte(studySession.startedAt, weekStart),
				lt(studySession.startedAt, addDays(weekStart, 7))
			)
		);
	return { planned, done: done.n, minutes: done.minutes };
}

/** Finished sessions in a period (newest first), for updates and the weekly report. */
export function sessionsBetween(db: DB, studentId: string, from: Date, to: Date) {
	return db
		.select()
		.from(studySession)
		.where(
			and(
				eq(studySession.studentId, studentId),
				gte(studySession.startedAt, from),
				lt(studySession.startedAt, to)
			)
		)
		.orderBy(desc(studySession.startedAt));
}

export async function addPlanItem(
	db: DB,
	studentId: string,
	by: string,
	v: {
		weekday: number;
		startMinute: number;
		minutes: number;
		subject: string;
		topic?: string | null;
	}
) {
	if (v.weekday < 0 || v.weekday > 6) return null;
	if (v.startMinute < 0 || v.startMinute > 1439) return null;
	const subject = v.subject.trim().slice(0, 60);
	if (!subject) return null;
	const [row] = await db
		.insert(studyPlanItem)
		.values({
			studentId,
			weekday: v.weekday,
			startMinute: v.startMinute,
			minutes: Math.min(240, Math.max(5, Math.round(v.minutes))),
			subject,
			topic: v.topic?.trim().slice(0, 80) || null,
			createdBy: by
		})
		.returning();
	return row;
}

export async function removePlanItem(db: DB, studentId: string, id: number) {
	await db
		.update(studyPlanItem)
		.set({ active: false })
		.where(and(eq(studyPlanItem.id, id), eq(studyPlanItem.studentId, studentId)));
}

/* ---------- telling the family (added in phase 5) ---------- */

/** "4:45" (12-hour clock, as people say it in Zimbabwe). */
export function clockShort(min: number) {
	const m = ((min % 1440) + 1440) % 1440;
	const h = Math.floor(m / 60) % 12 || 12;
	return `${h}:${String(m % 60).padStart(2, '0')}`;
}

/** "4:45 PM". */
export function clock12(min: number) {
	const m = ((min % 1440) + 1440) % 1440;
	return `${clockShort(m)} ${m < 720 ? 'AM' : 'PM'}`;
}

export const firstName = (name: string) => shortName(name) || name;

/**
 * Tell the parents who may see this student's study time that a focus session started or
 * finished. A stopped session is never sent. Returns how many parents were told.
 */
export async function tellFamilyStudy(
	db: DB,
	notify: Notify,
	studentId: string,
	session: {
		subject: string;
		plannedMinutes: number;
		startedAt: Date;
		endedAt?: Date | null;
		status: string;
	},
	event: 'started' | 'finished'
) {
	if (event === 'finished' && session.status !== 'done') return 0;
	const parents = await parentsWhoSee(db, studentId, 'study');
	if (!parents.length) return 0;
	const [s] = await db.select({ name: user.name }).from(user).where(eq(user.id, studentId));
	if (!s) return 0;
	const name = firstName(s.name);
	const link = `/parent?child=${encodeURIComponent(studentId)}`;
	let title: string;
	let body: string;
	if (event === 'started') {
		const end = local(new Date(session.startedAt.getTime() + session.plannedMinutes * 60_000));
		title = m.st5_n_started_s();
		body = m.st5_n_started_b({ name, subject: session.subject, time: clockShort(end.minutes) });
	} else {
		const ended = session.endedAt ?? new Date();
		const minutes = Math.max(
			1,
			Math.round((ended.getTime() - session.startedAt.getTime()) / 60_000)
		);
		title = m.st5_n_finished_s();
		body = m.st5_n_finished_b({ name, subject: session.subject, minutes });
	}
	for (const p of parents) await notify(p, title, body, { kind: 'study', link }).catch(() => {});
	return parents.length;
}
