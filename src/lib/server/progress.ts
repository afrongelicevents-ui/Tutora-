/**
 * Progress and assessments: every number here is computed from assessment_result rows
 * (marked tests, quizzes, Kahoot! scores, daily knowledge checks, marked homework).
 * With no results, functions return empty values and screens say so honestly.
 */
import { and, asc, desc, eq, gte, lt, sql } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { assessmentResult, exam, RESULT_SOURCES } from './db/v3.schema.ts';
import { addDays, localDate } from '../tz.ts';

/** A topic counts as "ready" when the average of its latest 3 results is at least this. */
export const READY_PCT = 70;
/** Topics below this are "needs practice" (tutor brief, guidance). */
export const WEAK_PCT = 60;

export type ResultSource = (typeof RESULT_SOURCES)[number];

export interface NewResult {
	studentId: string;
	tutorId?: string | null;
	source: ResultSource;
	title: string;
	subject: string;
	topic: string;
	score: number;
	maxScore: number;
	feedback?: string | null;
	takenOn?: string;
	setId?: number | null;
	homeworkAnswerId?: number | null;
	createdBy?: string | null;
}

export async function recordResult(db: DB, r: NewResult) {
	const maxScore = Math.max(1, Math.round(r.maxScore));
	const score = Math.min(maxScore, Math.max(0, Math.round(r.score)));
	const [row] = await db
		.insert(assessmentResult)
		.values({
			studentId: r.studentId,
			tutorId: r.tutorId ?? null,
			source: r.source,
			title: r.title.trim().slice(0, 120),
			subject: r.subject.trim().slice(0, 60),
			topic: r.topic.trim().slice(0, 80),
			score,
			maxScore,
			feedback: r.feedback?.trim().slice(0, 2000) || null,
			takenOn: r.takenOn ?? localDate(new Date()),
			setId: r.setId ?? null,
			homeworkAnswerId: r.homeworkAnswerId ?? null,
			createdBy: r.createdBy ?? null
		})
		.returning();
	return row;
}

export const pct = (score: number, max: number) => (max > 0 ? Math.round((100 * score) / max) : 0);

export interface TopicScore {
	subject: string;
	topic: string;
	/** average of the latest 3 results, 0–100 */
	pct: number;
	results: number;
	lastOn: string;
}

/** Score per topic: average of each topic's latest 3 results. Lowest first when `weakFirst`. */
export async function topicScores(
	db: DB,
	studentId: string,
	opts: { subject?: string; weakFirst?: boolean } = {}
): Promise<TopicScore[]> {
	const rows = await db.execute(sql`
		with ranked as (
			select subject, topic, score, max_score, taken_on,
				row_number() over (partition by lower(subject), lower(topic) order by taken_on desc, id desc) as rn,
				count(*) over (partition by lower(subject), lower(topic)) as n
			from ${assessmentResult}
			where student_id = ${studentId}
			${opts.subject ? sql`and lower(subject) = lower(${opts.subject})` : sql``}
		)
		select min(subject) as subject, min(topic) as topic,
			round(100.0 * sum(score) / nullif(sum(max_score), 0))::int as pct,
			max(n)::int as results, max(taken_on)::text as last_on
		from ranked where rn <= 3
		group by lower(subject), lower(topic)`);
	const list = ((rows as unknown as { rows?: unknown[] }).rows ?? (rows as unknown as unknown[])) as {
		subject: string;
		topic: string;
		pct: number;
		results: number;
		last_on: string;
	}[];
	const out = list.map((r) => ({
		subject: r.subject,
		topic: r.topic,
		pct: Number(r.pct),
		results: Number(r.results),
		lastOn: r.last_on
	}));
	out.sort((a, b) => (opts.weakFirst ? a.pct - b.pct : b.pct - a.pct) || a.topic.localeCompare(b.topic));
	return out;
}

/** Topics that need practice (lowest first), for the tutor's brief and family guidance. */
export async function weakTopics(db: DB, studentId: string, limit = 3) {
	return (await topicScores(db, studentId, { weakFirst: true }))
		.filter((t) => t.pct < WEAK_PCT)
		.slice(0, limit);
}

async function averageBetween(db: DB, studentId: string, from: string, to: string) {
	const [r] = await db
		.select({
			s: sql<number>`coalesce(sum(${assessmentResult.score}), 0)::int`,
			m: sql<number>`coalesce(sum(${assessmentResult.maxScore}), 0)::int`,
			n: sql<number>`count(*)::int`
		})
		.from(assessmentResult)
		.where(
			and(
				eq(assessmentResult.studentId, studentId),
				gte(assessmentResult.takenOn, from),
				lt(assessmentResult.takenOn, to)
			)
		);
	return r.n ? { pct: pct(r.s, r.m), n: r.n } : null;
}

/**
 * Overall score: all results in the last 30 days, compared with the 30 days before.
 * `current` is null when there are no results in the last 30 days.
 */
export async function overallProgress(db: DB, studentId: string, now = new Date()) {
	const today = localDate(addDays(now, 1));
	const d30 = localDate(addDays(now, -29));
	const d60 = localDate(addDays(now, -59));
	const [current, previous] = await Promise.all([
		averageBetween(db, studentId, d30, today),
		averageBetween(db, studentId, d60, d30)
	]);
	return { current, previous };
}

/** Marked work with feedback, newest first. */
export function recentResults(db: DB, studentId: string, limit = 20) {
	return db
		.select()
		.from(assessmentResult)
		.where(eq(assessmentResult.studentId, studentId))
		.orderBy(desc(assessmentResult.takenOn), desc(assessmentResult.id))
		.limit(limit);
}

export interface ExamReadiness {
	id: number;
	subject: string;
	title: string;
	examOn: string | null;
	daysLeft: number | null;
	topics: { topic: string; pct: number | null; ready: boolean }[];
	ready: number;
	total: number;
}

/** For each upcoming exam: which of its topics are ready (from real results only). */
export async function examReadiness(db: DB, studentId: string, now = new Date()): Promise<ExamReadiness[]> {
	const today = localDate(now);
	const exams = await db
		.select()
		.from(exam)
		.where(eq(exam.studentId, studentId))
		.orderBy(asc(exam.examOn));
	if (!exams.length) return [];
	const scores = await topicScores(db, studentId);
	const key = (s: string, t: string) => `${s.toLowerCase()}|${t.toLowerCase()}`;
	const bySubjectTopic = new Map(scores.map((s) => [key(s.subject, s.topic), s.pct]));
	return exams
		.filter((e) => !e.examOn || e.examOn >= today)
		.map((e) => {
			const topics = (e.topics ?? []).map((topic) => {
				const p = bySubjectTopic.get(key(e.subject, topic)) ?? null;
				return { topic, pct: p, ready: p !== null && p >= READY_PCT };
			});
			const daysLeft = e.examOn
				? Math.round((Date.parse(e.examOn) - Date.parse(today)) / 86_400_000)
				: null;
			return {
				id: e.id,
				subject: e.subject,
				title: e.title,
				examOn: e.examOn,
				daysLeft,
				topics,
				ready: topics.filter((t) => t.ready).length,
				total: topics.length
			};
		});
}

export async function addExam(
	db: DB,
	studentId: string,
	by: string,
	v: { subject: string; title: string; examOn: string | null; topics: string[] }
) {
	const topics = [...new Set(v.topics.map((t) => t.trim().slice(0, 80)).filter(Boolean))].slice(0, 20);
	const [row] = await db
		.insert(exam)
		.values({
			studentId,
			subject: v.subject.trim().slice(0, 60),
			title: v.title.trim().slice(0, 120),
			examOn: v.examOn,
			topics,
			createdBy: by
		})
		.returning();
	return row;
}

export async function removeExam(db: DB, studentId: string, id: number) {
	await db.delete(exam).where(and(eq(exam.id, id), eq(exam.studentId, studentId)));
}
