/**
 * Learning check-ins. The student picks how learning feels and decides, for each check-in,
 * whether their family sees it. A private note is never shown to family.
 */
import { and, asc, desc, eq, gte, inArray, isNull, lt, ne } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { user } from './db/auth.schema.ts';
import {
	checkin,
	checkinFollowupSent,
	checkinPref,
	CHECKIN_MOODS,
	daySummarySent,
	studySession,
	type CheckinMood
} from './db/v3.schema.ts';
import { addDays, local, localDate, startOfLocalDay } from '../tz.ts';
import { dayTick } from './db/personal.schema.ts';
import { MOOD_LEVEL, TOUGH, TOUGH_DAYS } from '../checkin-copy.ts';
import type { Notify } from './notify-core.ts';
import { todaysPlan } from './study.ts';
import { m } from '../paraglide/messages.js';

export { CHECKIN_MOODS, type CheckinMood };

export function isMood(v: unknown): v is CheckinMood {
	return typeof v === 'string' && (CHECKIN_MOODS as readonly string[]).includes(v);
}

/** Message key for each mood (labels live in messages/en.json). */
export const MOOD_KEY: Record<CheckinMood, string> = {
	confident: 'ci_confident',
	finding_hard: 'ci_finding_hard',
	need_help: 'ci_need_help',
	motivated: 'ci_motivated',
	need_break: 'ci_need_break'
};

export async function addCheckin(
	db: DB,
	studentId: string,
	v: {
		mood: CheckinMood;
		shared: boolean;
		note?: string | null;
		subject?: string | null;
		kind?: 'start' | 'followup';
		followupOf?: number | null;
	}
) {
	const [row] = await db
		.insert(checkin)
		.values({
			studentId,
			mood: v.mood,
			sharedWithFamily: v.shared,
			note: v.note?.trim().slice(0, NOTE_MAX) || null,
			subject: v.subject?.trim().slice(0, 60) || null,
			kind: v.kind ?? 'start',
			followupOf: v.followupOf ?? null
		})
		.returning();
	return row;
}

export const NOTE_MAX = 200;

/** Today's latest "How is learning going?" check-in by this student. */
export async function todaysCheckin(db: DB, studentId: string, now = new Date()) {
	const [row] = await db
		.select()
		.from(checkin)
		.where(
			and(
				eq(checkin.studentId, studentId),
				eq(checkin.kind, 'start'),
				gte(checkin.createdAt, startOfLocalDay(now))
			)
		)
		.orderBy(desc(checkin.createdAt))
		.limit(1);
	return row ?? null;
}

/** The student changes their mind about sharing one of their own check-ins. */
export async function setCheckinShared(db: DB, studentId: string, id: number, shared: boolean) {
	await db
		.update(checkin)
		.set({ sharedWithFamily: shared })
		.where(and(eq(checkin.id, id), eq(checkin.studentId, studentId)));
}

/** Minutes a child has to change their mind before family sees a shared check-in. */
export const SHARE_DELAY_MIN = 10;

/** Only the check-ins the child shared, without any note. Callers check the family link first. */
export function sharedCheckins(
	db: DB,
	studentId: string,
	since: Date,
	limit = 10,
	now = new Date()
) {
	return db
		.select({
			id: checkin.id,
			mood: checkin.mood,
			subject: checkin.subject,
			createdAt: checkin.createdAt
		})
		.from(checkin)
		.where(
			and(
				eq(checkin.studentId, studentId),
				eq(checkin.sharedWithFamily, true),
				gte(checkin.createdAt, since),
				// the undo window: not shown to family in the first minutes
				lt(checkin.createdAt, new Date(now.getTime() - SHARE_DELAY_MIN * 60_000))
			)
		)
		.orderBy(desc(checkin.createdAt))
		.limit(limit);
}

/** Recent check-ins a tutor may see, for the pre-lesson brief (newest first, last 7 days). */
export function recentForTutor(db: DB, studentId: string, now = new Date(), limit = 3) {
	return db
		.select({
			mood: checkin.mood,
			kind: checkin.kind,
			subject: checkin.subject,
			note: checkin.note,
			createdAt: checkin.createdAt
		})
		.from(checkin)
		.where(
			and(
				eq(checkin.studentId, studentId),
				eq(checkin.sharedWithTutor, true),
				gte(checkin.createdAt, addDays(now, -7))
			)
		)
		.orderBy(desc(checkin.createdAt))
		.limit(limit);
}

/** The latest check-in a tutor may see (the student shares check-ins with tutors by default). */
export async function latestForTutor(db: DB, studentId: string) {
	const [row] = await db
		.select({ mood: checkin.mood, subject: checkin.subject, createdAt: checkin.createdAt })
		.from(checkin)
		.where(and(eq(checkin.studentId, studentId), eq(checkin.sharedWithTutor, true)))
		.orderBy(desc(checkin.createdAt))
		.limit(1);
	return row ?? null;
}

export function recentCheckins(db: DB, studentId: string, limit = 20) {
	return db
		.select()
		.from(checkin)
		.where(eq(checkin.studentId, studentId))
		.orderBy(desc(checkin.createdAt))
		.limit(limit);
}

/* ------------------------------------------------------------------ remembered share choice */

export async function sharePref(db: DB, studentId: string) {
	const [p] = await db.select().from(checkinPref).where(eq(checkinPref.studentId, studentId));
	return p?.shareWithFamily ?? false;
}

/** "Share with my parent?" Yes/No: applies to this check-in and is remembered for the next. */
export async function answerShare(db: DB, studentId: string, id: number, shared: boolean) {
	await setCheckinShared(db, studentId, id, shared);
	await db
		.insert(checkinPref)
		.values({ studentId, shareWithFamily: shared })
		.onConflictDoUpdate({
			target: checkinPref.studentId,
			set: { shareWithFamily: shared, updatedAt: new Date() }
		});
}

/** Add a subject and/or a short note to one of the student's own check-ins. */
export async function setCheckinNote(
	db: DB,
	studentId: string,
	id: number,
	v: { note: string; subject: string }
) {
	await db
		.update(checkin)
		.set({
			note: v.note.trim().slice(0, NOTE_MAX) || null,
			subject: v.subject.trim().slice(0, 60) || null
		})
		.where(and(eq(checkin.id, id), eq(checkin.studentId, studentId)));
}

/* ------------------------------------------------------------------ today */

/** What the student is studying now or next today (a running session, else the plan). */
export async function studyingNow(db: DB, studentId: string, now = new Date()) {
	const [running] = await db
		.select({ subject: studySession.subject, topic: studySession.topic })
		.from(studySession)
		.where(
			and(
				eq(studySession.studentId, studentId),
				eq(studySession.status, 'running'),
				gte(studySession.startedAt, startOfLocalDay(now))
			)
		)
		.orderBy(desc(studySession.startedAt))
		.limit(1);
	if (running) return running.subject;
	const plan = await todaysPlan(db, studentId, now);
	const next = plan.find((p) => p.state !== 'done' && p.state !== 'missed') ?? plan[0];
	return next?.subject ?? null;
}

const FOLLOWUP_MINUTE = 19 * 60; // 7 PM

/**
 * Today's check-in state: the start check-in, its follow-up, and whether it's time to ask
 * "How did it go?" (a study session ended after the check-in, or it's 7 PM or later).
 */
export async function todayState(db: DB, studentId: string, now = new Date()) {
	const start = await todaysCheckin(db, studentId, now);
	if (!start) return { start: null, followup: null, askFollowup: false };
	const [followup] = await db
		.select()
		.from(checkin)
		.where(and(eq(checkin.studentId, studentId), eq(checkin.followupOf, start.id)))
		.orderBy(desc(checkin.createdAt))
		.limit(1);
	let askFollowup = false;
	if (!followup) {
		if (local(now).minutes >= FOLLOWUP_MINUTE) askFollowup = true;
		else {
			const [ended] = await db
				.select({ id: studySession.id })
				.from(studySession)
				.where(
					and(
						eq(studySession.studentId, studentId),
						ne(studySession.status, 'running'),
						gte(studySession.endedAt, start.createdAt)
					)
				)
				.limit(1);
			askFollowup = !!ended;
		}
	}
	return { start, followup: followup ?? null, askFollowup };
}

/* ------------------------------------------------------------------ days */

export interface DaySummary {
	date: string;
	startMood: CheckinMood | null;
	endMood: CheckinMood | null;
	sessions: number;
	topics: string[];
	streak: number;
	/** message key of the encouraging line (and its values) */
	line: { key: string; n?: number };
}

/**
 * One summary per day with a check-in or a study session, newest first: start feeling → end
 * feeling, sessions done, topics studied, streak that day, and one encouraging line.
 */
export async function daySummaries(
	db: DB,
	studentId: string,
	opts: { before?: string; days?: number } = {},
	now = new Date()
): Promise<{ days: DaySummary[]; more: boolean }> {
	const span = opts.days ?? 14;
	const endDay = opts.before ? new Date(opts.before + 'T12:00:00Z') : addDays(now, 1);
	const to = startOfLocalDay(endDay);
	const from = startOfLocalDay(addDays(endDay, -span));
	// sessions over a longer span so streaks are right at the edge of the window
	const [checks, sessions, older] = await Promise.all([
		db
			.select()
			.from(checkin)
			.where(
				and(
					eq(checkin.studentId, studentId),
					gte(checkin.createdAt, from),
					lt(checkin.createdAt, to)
				)
			)
			.orderBy(asc(checkin.createdAt)),
		db
			.select({
				subject: studySession.subject,
				topic: studySession.topic,
				status: studySession.status,
				startedAt: studySession.startedAt
			})
			.from(studySession)
			.where(
				and(
					eq(studySession.studentId, studentId),
					gte(studySession.startedAt, addDays(from, -120)),
					lt(studySession.startedAt, to)
				)
			),
		db
			.select({ id: checkin.id })
			.from(checkin)
			.where(and(eq(checkin.studentId, studentId), lt(checkin.createdAt, from)))
			.limit(1)
	]);
	const doneDays = new Set(
		sessions.filter((s) => s.status === 'done').map((s) => localDate(s.startedAt))
	);
	const dates = new Set<string>();
	for (const c of checks) dates.add(localDate(c.createdAt));
	for (const s of sessions) if (s.startedAt >= from) dates.add(localDate(s.startedAt));
	const out: DaySummary[] = [];
	for (const date of [...dates].sort().reverse()) {
		const dayChecks = checks.filter((c) => localDate(c.createdAt) === date);
		const starts = dayChecks.filter((c) => c.kind === 'start');
		const ends = dayChecks.filter((c) => c.kind === 'followup');
		const startMood = starts[0]?.mood ?? null;
		const endMood = ends.at(-1)?.mood ?? (starts.length > 1 ? starts.at(-1)!.mood : null);
		const daySessions = sessions.filter(
			(s) => s.startedAt >= from && localDate(s.startedAt) === date
		);
		const done = daySessions.filter((s) => s.status === 'done');
		const topics = [
			...new Set(daySessions.map((s) => (s.topic ? `${s.subject} · ${s.topic}` : s.subject)))
		];
		let streak = 0;
		for (let d = new Date(date + 'T12:00:00Z'); doneDays.has(localDate(d)); d = addDays(d, -1))
			streak++;
		const line =
			streak >= 3
				? { key: 'ds_line_streak', n: streak }
				: startMood && endMood && MOOD_LEVEL[endMood] > MOOD_LEVEL[startMood]
					? { key: 'ds_line_better' }
					: done.length
						? { key: 'ds_line_done' }
						: dayChecks.length
							? { key: 'ds_line_checked' }
							: { key: 'ds_line_rest' };
		out.push({ date, startMood, endMood, sessions: done.length, topics, streak, line });
	}
	return { days: out, more: older.length > 0 };
}

/* ------------------------------------------------------------------ the week */

export interface WeekDay {
	date: string;
	start: CheckinMood | null;
	end: CheckinMood | null;
	studied: boolean;
}

/** The last 7 days of feelings, and one plain-words insight from the real check-ins. */
export async function weekPattern(db: DB, studentId: string, now = new Date()) {
	const from = startOfLocalDay(addDays(now, -6));
	const [checks, sessions] = await Promise.all([
		db
			.select({ mood: checkin.mood, kind: checkin.kind, createdAt: checkin.createdAt })
			.from(checkin)
			.where(and(eq(checkin.studentId, studentId), gte(checkin.createdAt, from)))
			.orderBy(asc(checkin.createdAt)),
		db
			.select({ startedAt: studySession.startedAt })
			.from(studySession)
			.where(
				and(
					eq(studySession.studentId, studentId),
					eq(studySession.status, 'done'),
					gte(studySession.startedAt, from)
				)
			)
	]);
	const days: WeekDay[] = [];
	for (let i = 6; i >= 0; i--) {
		const date = localDate(addDays(now, -i));
		const c = checks.filter((x) => localDate(x.createdAt) === date);
		const starts = c.filter((x) => x.kind === 'start');
		const ends = c.filter((x) => x.kind === 'followup');
		days.push({
			date,
			start: starts[0]?.mood ?? null,
			end: ends.at(-1)?.mood ?? null,
			studied: sessions.some((s) => localDate(s.startedAt) === date)
		});
	}
	return {
		days,
		insight: insightFor(
			days,
			checks.map((c) => c.mood)
		)
	};
}

/** Rules, in order; each needs enough real check-ins to say it. */
export function insightFor(
	days: WeekDay[],
	moods: CheckinMood[]
): { key: string; n?: number; mood?: CheckinMood } | null {
	if (moods.length < 2) return null;
	const better = days.filter(
		(d) => d.start && d.end && MOOD_LEVEL[d.end] > MOOD_LEVEL[d.start]
	).length;
	if (better >= 2) return { key: 'ck_ins_better', n: better };
	const level = (d: WeekDay) => {
		const x = d.end ?? d.start;
		return x ? MOOD_LEVEL[x] : null;
	};
	const withStudy = days.filter((d) => d.studied && level(d) !== null);
	const without = days.filter((d) => !d.studied && level(d) !== null);
	if (withStudy.length >= 2 && without.length >= 2) {
		const good = (xs: WeekDay[]) => xs.filter((d) => level(d) === 2).length / xs.length;
		if (good(withStudy) > good(without)) return { key: 'ck_ins_study' };
	}
	const tough = moods.filter((x) => TOUGH.includes(x)).length;
	if (tough * 2 > moods.length) return { key: 'ck_ins_tough' };
	const count = new Map<CheckinMood, number>();
	for (const x of moods) count.set(x, (count.get(x) ?? 0) + 1);
	const [top] = [...count.entries()].sort((a, b) => b[1] - a[1]);
	return { key: 'ck_ins_most', mood: top[0] };
}

/* ------------------------------------------------------------------ gentle help suggestion */

/**
 * Days in a row (ending today or yesterday) with a "This is difficult" or "I need help"
 * check-in. At TOUGH_DAYS or more the student is gently offered "Talk to someone".
 * Not a mental-health tool: this never labels or diagnoses anyone.
 */
export async function toughDaysInARow(db: DB, studentId: string, now = new Date()) {
	const rows = await db
		.select({ createdAt: checkin.createdAt })
		.from(checkin)
		.where(
			and(
				eq(checkin.studentId, studentId),
				inArray(checkin.mood, [...TOUGH]),
				gte(checkin.createdAt, startOfLocalDay(addDays(now, -14)))
			)
		);
	const days = new Set(rows.map((r) => localDate(r.createdAt)));
	let d = startOfLocalDay(now);
	if (!days.has(localDate(d))) d = addDays(d, -1);
	let n = 0;
	while (days.has(localDate(d))) {
		n++;
		d = addDays(d, -1);
	}
	return n;
}

export const needsTalkSuggestion = async (db: DB, studentId: string, now = new Date()) =>
	(await toughDaysInARow(db, studentId, now)) >= TOUGH_DAYS;

/* ------------------------------------------------------------------ hourly job */

/**
 * "How did it go?": once per start check-in, after a study session ended after it, or from
 * 7 PM. In-app (and by email/phone where the student allows notifications).
 */
export async function sendCheckinFollowups(db: DB, notify: Notify, now = new Date()) {
	const starts = await db
		.select({ id: checkin.id, studentId: checkin.studentId })
		.from(checkin)
		.leftJoin(checkinFollowupSent, eq(checkinFollowupSent.checkinId, checkin.id))
		.where(
			and(
				eq(checkin.kind, 'start'),
				gte(checkin.createdAt, startOfLocalDay(now)),
				isNull(checkinFollowupSent.checkinId)
			)
		)
		.orderBy(desc(checkin.createdAt));
	let sent = 0;
	const seen = new Set<string>();
	for (const s of starts) {
		if (seen.has(s.studentId)) continue; // only the latest start check-in per student
		seen.add(s.studentId);
		const state = await todayState(db, s.studentId, now);
		if (!state.askFollowup || state.start?.id !== s.id) continue;
		const claimed = await db
			.insert(checkinFollowupSent)
			.values({ checkinId: s.id })
			.onConflictDoNothing()
			.returning({ id: checkinFollowupSent.checkinId });
		if (!claimed.length) continue;
		await notify(s.studentId, m.ck_fu_notify_s(), m.ck_fu_notify_b(), {
			kind: 'reminder',
			link: '/student/progress#checkin'
		}).catch(() => {});
		sent++;
	}
	return sent;
}

const SUMMARY_MINUTE = 20 * 60; // 8 PM

/** The evening "review your day" note (from 8 PM, once per student and day, if they did anything). */
export async function sendDaySummaries(db: DB, notify: Notify, now = new Date()) {
	if (local(now).minutes < SUMMARY_MINUTE) return 0;
	const today = localDate(now);
	const since = startOfLocalDay(now);
	const [a, b, c] = await Promise.all([
		db.selectDistinct({ id: checkin.studentId }).from(checkin).where(gte(checkin.createdAt, since)),
		db
			.selectDistinct({ id: studySession.studentId })
			.from(studySession)
			.where(gte(studySession.startedAt, since)),
		db.selectDistinct({ id: dayTick.studentId }).from(dayTick).where(eq(dayTick.onDate, today))
	]);
	const ids = [...new Set([...a, ...b, ...c].map((x) => x.id))];
	if (!ids.length) return 0;
	const students = await db
		.select({ id: user.id })
		.from(user)
		.where(and(inArray(user.id, ids), eq(user.role, 'student')));
	let sent = 0;
	for (const s of students) {
		const claimed = await db
			.insert(daySummarySent)
			.values({ studentId: s.id, onDate: today })
			.onConflictDoNothing()
			.returning({ id: daySummarySent.studentId });
		if (!claimed.length) continue;
		await notify(s.id, m.ds_notify_s(), m.ds_notify_b(), {
			kind: 'reminder',
			link: '/student/report'
		}).catch(() => {});
		sent++;
	}
	return sent;
}

/**
 * Tell family about check-ins the child shared, once the undo window has passed. Hourly; each
 * check-in once. Only the feeling word goes out, never a note.
 */
export async function sendSharedCheckinNotes(
	db: DB,
	tell: (studentId: string, mood: CheckinMood) => Promise<void>,
	now = new Date()
) {
	const due = await db
		.update(checkin)
		.set({ familyNotifiedAt: now })
		.where(
			and(
				eq(checkin.sharedWithFamily, true),
				isNull(checkin.familyNotifiedAt),
				lt(checkin.createdAt, new Date(now.getTime() - SHARE_DELAY_MIN * 60_000)),
				gte(checkin.createdAt, addDays(now, -2))
			)
		)
		.returning({ studentId: checkin.studentId, mood: checkin.mood });
	for (const d of due) await tell(d.studentId, d.mood).catch(() => {});
	return due.length;
}
