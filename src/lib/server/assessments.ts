/**
 * The tutor's quizzes and tests, assigned quizzes, and the student's daily knowledge check.
 * Questions are picked and marked on the server only; the browser never sees the answers
 * before the work is handed in. Every score is saved with progress.recordResult.
 */
import { and, asc, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { user } from './db/auth.schema.ts';
import { enrollment } from './db/app.schema.ts';
import {
	assessmentResult,
	question,
	questionSet,
	quizAssignment,
	schoolSubject
} from './db/v3.schema.ts';
import { recordResult, weakTopics } from './progress.ts';
import { localDate } from '../tz.ts';
import { m } from '../paraglide/messages.js';

export class AssessFail extends Error {
	constructor(public code: string) {
		super(code);
	}
}

export const SET_KINDS = ['quiz', 'test'] as const;
export type SetKind = (typeof SET_KINDS)[number];
export const MIN_CHOICES = 2;
export const MAX_CHOICES = 5;
/** questions in one daily knowledge check */
export const DAILY_N = 5;
/** a question is not asked again within this many checks, when there are enough questions */
export const NO_REPEAT_DAYS = 7;

/* ------------------------------------------------------------------ question sets (tutor) */

export interface SetInput {
	kind: SetKind;
	title: string;
	subject: string;
	topic: string;
	level?: string | null;
	dailyChecks: boolean;
}

function cleanSet(v: SetInput) {
	const out = {
		kind: (SET_KINDS as readonly string[]).includes(v.kind) ? v.kind : 'quiz',
		title: v.title.trim().slice(0, 120),
		subject: v.subject.trim().slice(0, 60),
		topic: v.topic.trim().slice(0, 80),
		level: v.level?.trim().slice(0, 40) || null,
		dailyChecks: !!v.dailyChecks
	};
	if (!out.title || !out.subject || !out.topic) throw new AssessFail('st5_err_set');
	return out;
}

export interface QuestionInput {
	prompt: string;
	/** up to 5 choices as typed; blank ones are dropped */
	choices: string[];
	/** index into `choices` as typed */
	answer: number;
	explanation?: string | null;
}

/** 2–5 filled-in choices, and the correct answer must be one of them. */
export function cleanQuestion(v: QuestionInput) {
	const prompt = v.prompt.trim().slice(0, 1000);
	const raw = v.choices.slice(0, MAX_CHOICES).map((c) => c.trim().slice(0, 300));
	if (!prompt) throw new AssessFail('st5_err_prompt');
	if (!Number.isInteger(v.answer) || !raw[v.answer]) throw new AssessFail('st5_err_answer');
	const choices = raw.filter(Boolean);
	if (choices.length < MIN_CHOICES) throw new AssessFail('st5_err_choices');
	const answer = raw.slice(0, v.answer).filter(Boolean).length;
	return { prompt, choices, answer, explanation: v.explanation?.trim().slice(0, 1000) || null };
}

const qCount = sql<number>`(select count(*)::int from ${question} where ${question.setId} = ${questionSet.id})`;

/** The tutor's own sets, newest first, with how many questions each has. */
export function listSets(db: DB, tutorId: string) {
	return db
		.select({
			id: questionSet.id,
			kind: questionSet.kind,
			title: questionSet.title,
			subject: questionSet.subject,
			topic: questionSet.topic,
			level: questionSet.level,
			dailyChecks: questionSet.dailyChecks,
			questions: qCount
		})
		.from(questionSet)
		.where(eq(questionSet.tutorId, tutorId))
		.orderBy(desc(questionSet.createdAt), desc(questionSet.id));
}

/** One of the tutor's own sets with its questions (answers included: tutor only). */
export async function getSet(db: DB, tutorId: string, id: number) {
	const [set] = await db
		.select()
		.from(questionSet)
		.where(and(eq(questionSet.id, id), eq(questionSet.tutorId, tutorId)));
	if (!set) return null;
	const questions = await db
		.select()
		.from(question)
		.where(eq(question.setId, id))
		.orderBy(asc(question.sortOrder), asc(question.id));
	return { set, questions };
}

export async function createSet(db: DB, tutorId: string, v: SetInput) {
	const [row] = await db
		.insert(questionSet)
		.values({ tutorId, ...cleanSet(v) })
		.returning();
	return row;
}

export async function updateSet(db: DB, tutorId: string, id: number, v: SetInput) {
	const [row] = await db
		.update(questionSet)
		.set(cleanSet(v))
		.where(and(eq(questionSet.id, id), eq(questionSet.tutorId, tutorId)))
		.returning();
	if (!row) throw new AssessFail('st5_err_not_found');
	return row;
}

/** Deletes the set, its questions and assignments; saved results stay (without the link). */
export async function deleteSet(db: DB, tutorId: string, id: number) {
	await db.delete(questionSet).where(and(eq(questionSet.id, id), eq(questionSet.tutorId, tutorId)));
}

const ownSetIds = (db: DB, tutorId: string) =>
	db.select({ id: questionSet.id }).from(questionSet).where(eq(questionSet.tutorId, tutorId));

export async function addQuestion(db: DB, tutorId: string, setId: number, v: QuestionInput) {
	const q = cleanQuestion(v);
	const own = await getSet(db, tutorId, setId);
	if (!own) throw new AssessFail('st5_err_not_found');
	if (own.questions.length >= 50) throw new AssessFail('st5_err_too_many');
	const sortOrder = Math.max(0, ...own.questions.map((x) => x.sortOrder)) + 1;
	const [row] = await db
		.insert(question)
		.values({ setId, ...q, sortOrder })
		.returning();
	return row;
}

export async function updateQuestion(db: DB, tutorId: string, id: number, v: QuestionInput) {
	const q = cleanQuestion(v);
	const [row] = await db
		.update(question)
		.set(q)
		.where(and(eq(question.id, id), inArray(question.setId, ownSetIds(db, tutorId))))
		.returning();
	if (!row) throw new AssessFail('st5_err_not_found');
	return row;
}

export async function removeQuestion(db: DB, tutorId: string, id: number) {
	await db
		.delete(question)
		.where(and(eq(question.id, id), inArray(question.setId, ownSetIds(db, tutorId))));
}

/* ------------------------------------------------------------------ assigning (tutor) */

/** The tutor's enrolled students (role student), for assigning quizzes. */
export function enrolledStudents(db: DB, tutorId: string) {
	return db
		.select({ id: user.id, name: user.name })
		.from(enrollment)
		.innerJoin(user, eq(user.id, enrollment.userId))
		.where(and(eq(enrollment.tutorId, tutorId), eq(user.role, 'student')))
		.orderBy(asc(user.name));
}

async function isMyStudent(db: DB, tutorId: string, studentId: string) {
	const [r] = await db
		.select({ id: user.id })
		.from(enrollment)
		.innerJoin(user, eq(user.id, enrollment.userId))
		.where(
			and(
				eq(enrollment.tutorId, tutorId),
				eq(enrollment.userId, studentId),
				eq(user.role, 'student')
			)
		);
	return !!r;
}

/**
 * Give one of the tutor's sets to one of the tutor's enrolled students. Giving it again
 * changes the due date and opens it again.
 */
export async function assignSet(
	db: DB,
	tutorId: string,
	setId: number,
	studentId: string,
	dueOn: string | null
) {
	const own = await getSet(db, tutorId, setId);
	if (!own) throw new AssessFail('st5_err_not_found');
	if (!own.questions.length) throw new AssessFail('st5_err_no_questions');
	if (!(await isMyStudent(db, tutorId, studentId))) throw new AssessFail('st5_err_not_student');
	const [row] = await db
		.insert(quizAssignment)
		.values({ setId, studentId, dueOn })
		.onConflictDoUpdate({
			target: [quizAssignment.setId, quizAssignment.studentId],
			set: { dueOn, doneAt: null }
		})
		.returning();
	return { assignment: row, set: own.set };
}

export async function unassign(db: DB, tutorId: string, assignmentId: number) {
	await db
		.delete(quizAssignment)
		.where(
			and(
				eq(quizAssignment.id, assignmentId),
				inArray(quizAssignment.setId, ownSetIds(db, tutorId))
			)
		);
}

/** Who has this set, and their latest score on it. */
export async function assignmentsForSet(db: DB, tutorId: string, setId: number) {
	const rows = await db
		.select({
			id: quizAssignment.id,
			studentId: quizAssignment.studentId,
			name: user.name,
			dueOn: quizAssignment.dueOn,
			doneAt: quizAssignment.doneAt
		})
		.from(quizAssignment)
		.innerJoin(questionSet, eq(questionSet.id, quizAssignment.setId))
		.innerJoin(user, eq(user.id, quizAssignment.studentId))
		.where(and(eq(quizAssignment.setId, setId), eq(questionSet.tutorId, tutorId)))
		.orderBy(asc(user.name));
	if (!rows.length) return [];
	const results = await db
		.select()
		.from(assessmentResult)
		.where(
			and(
				eq(assessmentResult.setId, setId),
				inArray(
					assessmentResult.studentId,
					rows.map((r) => r.studentId)
				),
				inArray(assessmentResult.source, ['quiz', 'test'])
			)
		)
		.orderBy(desc(assessmentResult.id));
	return rows.map((r) => {
		const res = results.find((x) => x.studentId === r.studentId);
		return { ...r, score: res?.score ?? null, maxScore: res?.maxScore ?? null };
	});
}

/** Results on the tutor's own sets, for students still enrolled with the tutor (newest first). */
export function resultsForTutor(db: DB, tutorId: string, limit = 30) {
	return db
		.select({
			id: assessmentResult.id,
			studentId: assessmentResult.studentId,
			name: user.name,
			source: assessmentResult.source,
			title: assessmentResult.title,
			topic: assessmentResult.topic,
			score: assessmentResult.score,
			maxScore: assessmentResult.maxScore,
			takenOn: assessmentResult.takenOn,
			setId: assessmentResult.setId
		})
		.from(assessmentResult)
		.innerJoin(questionSet, eq(questionSet.id, assessmentResult.setId))
		.innerJoin(
			enrollment,
			and(eq(enrollment.tutorId, tutorId), eq(enrollment.userId, assessmentResult.studentId))
		)
		.innerJoin(user, eq(user.id, assessmentResult.studentId))
		.where(eq(questionSet.tutorId, tutorId))
		.orderBy(desc(assessmentResult.takenOn), desc(assessmentResult.id))
		.limit(limit);
}

/* ------------------------------------------------------------------ marking */

export interface ReviewItem {
	id: number;
	prompt: string;
	choices: string[];
	answer: number;
	chosen: number | null;
	correct: boolean;
	explanation: string | null;
}

type QRow = typeof question.$inferSelect;

/** Read "a<question id>" = choice index from a form. */
export function answersFromForm(data: FormData): Map<number, number> {
	const out = new Map<number, number>();
	for (const [k, v] of data.entries()) {
		const id = /^a(\d{1,9})$/.exec(k)?.[1];
		const n = Number(v);
		if (id && typeof v === 'string' && /^\d$/.test(v)) out.set(Number(id), n);
	}
	return out;
}

export function mark(questions: QRow[], answers: Map<number, number>): ReviewItem[] {
	return questions.map((q) => {
		const a = answers.get(q.id);
		const chosen = a !== undefined && a >= 0 && a < q.choices.length ? a : null;
		return {
			id: q.id,
			prompt: q.prompt,
			choices: q.choices,
			answer: q.answer,
			chosen,
			correct: chosen === q.answer,
			explanation: q.explanation
		};
	});
}

/** Questions as the student sees them before handing in: no answers, no explanations. */
const forStudent = (q: QRow) => ({ id: q.id, prompt: q.prompt, choices: q.choices });

/* ------------------------------------------------------------------ assigned quizzes (student) */

/** The student's own assigned quizzes and tests: open ones first. */
export function myAssignments(db: DB, studentId: string) {
	return db
		.select({
			id: quizAssignment.id,
			dueOn: quizAssignment.dueOn,
			doneAt: quizAssignment.doneAt,
			kind: questionSet.kind,
			title: questionSet.title,
			subject: questionSet.subject,
			topic: questionSet.topic,
			tutorName: user.name
		})
		.from(quizAssignment)
		.innerJoin(questionSet, eq(questionSet.id, quizAssignment.setId))
		.innerJoin(user, eq(user.id, questionSet.tutorId))
		.where(eq(quizAssignment.studentId, studentId))
		.orderBy(
			sql`${quizAssignment.doneAt} is not null`,
			sql`${quizAssignment.dueOn} asc nulls last`,
			desc(quizAssignment.id)
		);
}

/** One of the student's own assignments, ready to take (or the saved score when done). */
export async function assignmentToTake(db: DB, studentId: string, id: number) {
	const [a] = await db
		.select({ assignment: quizAssignment, set: questionSet, tutorName: user.name })
		.from(quizAssignment)
		.innerJoin(questionSet, eq(questionSet.id, quizAssignment.setId))
		.innerJoin(user, eq(user.id, questionSet.tutorId))
		.where(and(eq(quizAssignment.id, id), eq(quizAssignment.studentId, studentId)));
	if (!a) return null;
	const qs = await db
		.select()
		.from(question)
		.where(eq(question.setId, a.set.id))
		.orderBy(asc(question.sortOrder), asc(question.id));
	let result: { score: number; maxScore: number } | null = null;
	if (a.assignment.doneAt) {
		const [r] = await db
			.select({ score: assessmentResult.score, maxScore: assessmentResult.maxScore })
			.from(assessmentResult)
			.where(
				and(
					eq(assessmentResult.studentId, studentId),
					eq(assessmentResult.setId, a.set.id),
					inArray(assessmentResult.source, ['quiz', 'test'])
				)
			)
			.orderBy(desc(assessmentResult.id))
			.limit(1);
		result = r ?? null;
	}
	return {
		id: a.assignment.id,
		dueOn: a.assignment.dueOn,
		doneAt: a.assignment.doneAt,
		kind: a.set.kind,
		title: a.set.title,
		subject: a.set.subject,
		topic: a.set.topic,
		tutorName: a.tutorName,
		questions: qs.map(forStudent),
		result
	};
}

/**
 * Hand in an assigned quiz: only the student's own, only once. Marked here on the server
 * and saved as a 'quiz' or 'test' result for the set's topic.
 */
export async function submitAssignment(
	db: DB,
	studentId: string,
	id: number,
	answers: Map<number, number>,
	now = new Date()
) {
	return db.transaction(async (tx) => {
		const [a] = await tx
			.update(quizAssignment)
			.set({ doneAt: now })
			.where(
				and(
					eq(quizAssignment.id, id),
					eq(quizAssignment.studentId, studentId),
					isNull(quizAssignment.doneAt)
				)
			)
			.returning();
		if (!a) throw new AssessFail('st5_err_quiz_closed');
		const [set] = await tx.select().from(questionSet).where(eq(questionSet.id, a.setId));
		const qs = await tx
			.select()
			.from(question)
			.where(eq(question.setId, a.setId))
			.orderBy(asc(question.sortOrder), asc(question.id));
		if (!set || !qs.length) throw new AssessFail('st5_err_no_questions');
		const review = mark(qs, answers);
		const score = review.filter((r) => r.correct).length;
		await recordResult(tx as unknown as DB, {
			studentId,
			tutorId: set.tutorId,
			source: set.kind,
			title: set.title,
			subject: set.subject,
			topic: set.topic,
			score,
			maxScore: qs.length,
			takenOn: localDate(now),
			setId: set.id,
			createdBy: studentId
		});
		return { score, maxScore: qs.length, review };
	});
}

/* ------------------------------------------------------------------ daily knowledge check */

/** FNV-1a: a stable, per-student order of questions. */
function hash(s: string) {
	let h = 0x811c9dc5;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 0x01000193) >>> 0;
	}
	return h;
}

/**
 * Which questions go in check number `c` (0 = the student's first check).
 * `pref` (topics at school now / topics to practise) and `other` are each in a fixed order
 * and are worked through in turn, so a question comes back only after the others have had a
 * turn. Preferred questions are spread so each comes once every 7 checks; when there are too
 * few questions in all, repeats can't be avoided and more preferred questions fill the gap.
 */
export function chooseForCheck(pref: number[], other: number[], c: number, n = DAILY_N) {
	const P = pref.length;
	const O = other.length;
	const pCount = (j: number) =>
		P
			? Math.min(
					n,
					P,
					Math.max(
						0,
						Math.floor(((j + 1) * P) / NO_REPEAT_DAYS) - Math.floor((j * P) / NO_REPEAT_DAYS)
					)
				)
			: 0;
	let pOff = 0;
	let oOff = 0;
	for (let j = 0; j < c; j++) {
		const p = pCount(j);
		pOff += p;
		oOff += Math.min(O, n - p);
	}
	const out: number[] = [];
	const p = pCount(c);
	for (let i = 0; i < p; i++) out.push(pref[(pOff + i) % P]);
	const k = Math.min(O, n - out.length);
	for (let i = 0; i < k; i++) out.push(other[(oOff + i) % O]);
	for (let i = 0; out.length < n && i < P; i++) {
		const q = pref[(pOff + p + i) % P];
		if (!out.includes(q)) out.push(q);
	}
	return out;
}

/** Questions the student may get: sets of tutors they are enrolled with, open to daily checks. */
async function eligibleQuestions(db: DB, studentId: string, ids?: number[]) {
	return db
		.select({ q: question, set: questionSet })
		.from(question)
		.innerJoin(questionSet, eq(questionSet.id, question.setId))
		.innerJoin(
			enrollment,
			and(eq(enrollment.tutorId, questionSet.tutorId), eq(enrollment.userId, studentId))
		)
		.where(and(eq(questionSet.dailyChecks, true), ids ? inArray(question.id, ids) : undefined));
}

/** Topics at school now and topics that need practice (lower case). */
async function preferredTopics(db: DB, studentId: string) {
	const [school, weak] = await Promise.all([
		db
			.select({ t: schoolSubject.currentTopic })
			.from(schoolSubject)
			.where(eq(schoolSubject.studentId, studentId)),
		weakTopics(db, studentId, 10)
	]);
	return [...school.map((s) => s.t), ...weak.map((w) => w.topic)]
		.filter((t): t is string => !!t?.trim())
		.map((t) => t.trim().toLowerCase());
}

const matches = (topic: string, wanted: string[]) => {
	const t = topic.trim().toLowerCase();
	return wanted.some((w) => w.includes(t) || t.includes(w));
};

/** Today's daily-check results (one row per topic), or null if not done today. */
export async function checkDoneToday(db: DB, studentId: string, now = new Date()) {
	const rows = await db
		.select({ score: assessmentResult.score, maxScore: assessmentResult.maxScore })
		.from(assessmentResult)
		.where(
			and(
				eq(assessmentResult.studentId, studentId),
				eq(assessmentResult.source, 'daily_check'),
				eq(assessmentResult.takenOn, localDate(now))
			)
		);
	if (!rows.length) return null;
	return {
		score: rows.reduce((s, r) => s + r.score, 0),
		maxScore: rows.reduce((s, r) => s + r.maxScore, 0)
	};
}

async function checksBefore(db: DB, studentId: string, today: string) {
	const [r] = await db
		.select({ n: sql<number>`count(distinct ${assessmentResult.takenOn})::int` })
		.from(assessmentResult)
		.where(
			and(
				eq(assessmentResult.studentId, studentId),
				eq(assessmentResult.source, 'daily_check'),
				lt(assessmentResult.takenOn, today)
			)
		);
	return r.n;
}

/* signed list of today's questions, so the student can't swap in other questions */

const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) =>
	btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
async function hmac(secret: string, data: string) {
	const key = await crypto.subtle.importKey(
		'raw',
		enc.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data))));
}

export async function signCheck(secret: string, studentId: string, date: string, ids: number[]) {
	const payload = `${date}.${ids.join('-')}`;
	return `${payload}.${await hmac(secret, `daily:${studentId}:${payload}`)}`;
}

export async function readCheck(secret: string, studentId: string, token: string) {
	const x = /^(\d{4}-\d{2}-\d{2})\.(\d{1,9}(?:-\d{1,9}){0,9})\.([\w-]{20,})$/.exec(token);
	if (!x) return null;
	const expected = await hmac(secret, `daily:${studentId}:${x[1]}.${x[2]}`);
	if (expected.length !== x[3].length) return null;
	let diff = 0;
	for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ x[3].charCodeAt(i);
	if (diff) return null;
	return { date: x[1], ids: x[2].split('-').map(Number) };
}

/**
 * Today's check for the student: up to 5 questions (no answers) and a signed token, or
 * `done` with today's score. `questions` is empty when their tutors haven't added any.
 */
export async function dailyCheck(db: DB, studentId: string, secret: string, now = new Date()) {
	const today = localDate(now);
	const done = await checkDoneToday(db, studentId, now);
	if (done) return { done, questions: [], token: null };
	const [rows, wanted, c] = await Promise.all([
		eligibleQuestions(db, studentId),
		preferredTopics(db, studentId),
		checksBefore(db, studentId, today)
	]);
	const valid = rows.filter((r) => r.q.answer < r.q.choices.length);
	const order = (a: (typeof valid)[number], b: (typeof valid)[number]) =>
		hash(`${studentId}:${a.q.id}`) - hash(`${studentId}:${b.q.id}`) || a.q.id - b.q.id;
	const pref = valid.filter((r) => matches(r.set.topic, wanted)).sort(order);
	const other = valid.filter((r) => !matches(r.set.topic, wanted)).sort(order);
	const ids = chooseForCheck(
		pref.map((r) => r.q.id),
		other.map((r) => r.q.id),
		c
	);
	if (!ids.length) return { done: null, questions: [], token: null };
	const byId = new Map(valid.map((r) => [r.q.id, r]));
	return {
		done: null,
		questions: ids.map((id) => ({
			...forStudent(byId.get(id)!.q),
			subject: byId.get(id)!.set.subject,
			topic: byId.get(id)!.set.topic
		})),
		token: await signCheck(secret, studentId, today, ids)
	};
}

/**
 * Hand in today's check. The question list comes from the signed token (made today, for this
 * student, still from their tutors); answers are marked here. One result per topic is saved.
 */
export async function submitDailyCheck(
	db: DB,
	studentId: string,
	secret: string,
	token: string,
	answers: Map<number, number>,
	now = new Date()
) {
	const today = localDate(now);
	const t = await readCheck(secret, studentId, token);
	if (!t || t.date !== today) throw new AssessFail('st5_err_check_old');
	const rows = await eligibleQuestions(db, studentId, t.ids);
	const byId = new Map(rows.map((r) => [r.q.id, r]));
	if (t.ids.some((id) => !byId.has(id))) throw new AssessFail('st5_err_check_old');
	const picked = t.ids.map((id) => byId.get(id)!);
	return db.transaction(async (tx) => {
		// one check a day, even if the form is sent twice at once
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'daily:' + studentId}))`);
		if (await checkDoneToday(tx as unknown as DB, studentId, now))
			throw new AssessFail('st5_err_check_done');
		const review = mark(
			picked.map((r) => r.q),
			answers
		);
		const groups = new Map<
			string,
			{ subject: string; topic: string; tutorId: string; setId: number; score: number; max: number }
		>();
		picked.forEach((r, i) => {
			const key = `${r.set.subject.toLowerCase()}|${r.set.topic.toLowerCase()}`;
			const g = groups.get(key) ?? {
				subject: r.set.subject,
				topic: r.set.topic,
				tutorId: r.set.tutorId,
				setId: r.set.id,
				score: 0,
				max: 0
			};
			g.max++;
			if (review[i].correct) g.score++;
			groups.set(key, g);
		});
		for (const g of groups.values())
			await recordResult(tx as unknown as DB, {
				studentId,
				tutorId: g.tutorId,
				source: 'daily_check',
				title: m.st5_daily_title(),
				subject: g.subject,
				topic: g.topic,
				score: g.score,
				maxScore: g.max,
				takenOn: today,
				setId: g.setId,
				createdBy: studentId
			});
		return {
			score: review.filter((r) => r.correct).length,
			maxScore: review.length,
			review: review.map((r, i) => ({ ...r, topic: picked[i].set.topic }))
		};
	});
}
