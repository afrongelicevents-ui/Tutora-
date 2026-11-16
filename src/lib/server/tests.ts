/**
 * Tests from the question bank (free for every tutor, no AI needed).
 *
 * - The question bank: the tutor's own questions, tagged by subject, form, chapter, term and
 *   difficulty; multiple choice (marked automatically), short answer (marked against the
 *   accepted answers; the tutor can change it), written (the tutor marks) and maths with
 *   changing numbers (marked automatically). Private unless the tutor shares one with the
 *   Tutora bank; other tutors can copy shared questions into their own bank.
 * - The test builder picks questions at random from the bank. Each student gets the
 *   questions (and the choices) in their own order, and their own numbers.
 * - Taking a test: the questions as that student got them are kept with the attempt, so
 *   marking never changes when the bank is edited. An optional time limit is checked here.
 * - Scores go into progress (assessment_result) once everything is marked: one result per
 *   chapter, with the term, so progress and reports can show chapters and terms.
 *
 * Only original questions: never past exam papers or textbook questions (shown on the form).
 */
import { and, asc, desc, eq, ilike, inArray, isNotNull, isNull, ne, sql } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { user } from './db/auth.schema.ts';
import { enrollment } from './db/app.schema.ts';
import {
	assessmentResult,
	DIFFICULTIES,
	question,
	questionSet,
	quizAssignment,
	QUESTION_TYPES,
	type Difficulty,
	type QuestionType
} from './db/v3.schema.ts';
import { testAttempt, type AttemptItem } from './db/tests.schema.ts';
import { recordResult } from './progress.ts';
import {
	cleanTemplate,
	hashText,
	instantiate,
	numberMatches,
	seededRandom,
	TemplateFail,
	type QuestionTemplate
} from '../math-template.ts';
import { localDate } from '../tz.ts';

export class TestFail extends Error {
	constructor(
		public code: string,
		public n?: number
	) {
		super(code);
	}
}

export const TERMS = ['Term 1', 'Term 2', 'Term 3'] as const;
export const MAX_TEST_QUESTIONS = 40;
export const MAX_TIMER_MINUTES = 180;
/** handing in this long after the time limit still counts as on time (slow networks) */
export const GRACE_MS = 60_000;
const MAX_BANK = 2_000;

/* ------------------------------------------------------------------ cleaning */

export interface BankInput {
	type: QuestionType | 'maths';
	prompt: string;
	choices?: string[];
	answer?: number;
	accepted?: string[];
	template?: QuestionTemplate | null;
	marks?: number;
	explanation?: string | null;
	subject: string;
	form?: string | null;
	chapter: string;
	term?: string | null;
	difficulty?: string | null;
	shared?: boolean;
}

const cut = (v: unknown, n: number) =>
	String(v ?? '')
		.trim()
		.slice(0, n);

/** Checks one bank question and returns the columns to save. Throws TestFail. */
export function cleanBankQuestion(v: BankInput) {
	const prompt = cut(v.prompt, 1500);
	const subject = cut(v.subject, 60);
	const chapter = cut(v.chapter, 80);
	if (!prompt) throw new TestFail('st5_err_prompt');
	if (!subject || !chapter) throw new TestFail('qb_err_tags');
	const term = v.term && (TERMS as readonly string[]).includes(v.term) ? v.term : null;
	const difficulty = (DIFFICULTIES as readonly string[]).includes(v.difficulty ?? '')
		? (v.difficulty as Difficulty)
		: null;
	const marks = Math.max(1, Math.min(20, Math.round(Number(v.marks) || 1)));
	const base = {
		prompt,
		subject,
		chapter,
		form: cut(v.form, 40) || null,
		term,
		difficulty,
		marks,
		explanation: cut(v.explanation, 1000) || null,
		shared: !!v.shared
	};
	if (v.type === 'mcq') {
		const raw = (v.choices ?? []).slice(0, 5).map((c) => cut(c, 300));
		const a = Number(v.answer);
		if (!Number.isInteger(a) || !raw[a]) throw new TestFail('st5_err_answer');
		const choices = raw.filter(Boolean);
		if (choices.length < 2) throw new TestFail('st5_err_choices');
		const answer = raw.slice(0, a).filter(Boolean).length;
		return { ...base, type: 'mcq' as const, choices, answer, accepted: [], template: null };
	}
	if (v.type === 'short') {
		const accepted = [...new Set((v.accepted ?? []).map((x) => cut(x, 200)).filter(Boolean))].slice(
			0,
			10
		);
		if (!accepted.length) throw new TestFail('qb_err_accepted');
		return { ...base, type: 'short' as const, choices: [], answer: 0, accepted, template: null };
	}
	if (v.type === 'maths') {
		if (!v.template) throw new TestFail('qb_err_formula');
		let template: QuestionTemplate;
		try {
			template = cleanTemplate(v.template, prompt);
		} catch (e) {
			if (e instanceof TemplateFail) throw new TestFail(e.code);
			throw e;
		}
		return { ...base, type: 'short' as const, choices: [], answer: 0, accepted: [], template };
	}
	if (v.type === 'written')
		return {
			...base,
			type: 'written' as const,
			choices: [],
			answer: 0,
			accepted: [],
			template: null
		};
	throw new TestFail('qb_err_type');
}

/** Short answers: the same letters and words, ignoring capitals, spaces and a final full stop. */
export function sameShortAnswer(given: string, accepted: string[]) {
	const norm = (s: string) =>
		s
			.normalize('NFKC')
			.toLowerCase()
			.replace(/\s+/g, ' ')
			.trim()
			.replace(/[.!]+$/, '');
	const g = norm(given);
	if (!g) return false;
	return accepted.some((a) => {
		const x = norm(a);
		return x === g || x.replace(/ /g, '') === g.replace(/ /g, '');
	});
}

/* ------------------------------------------------------------------ the bank */

export interface BankFilter {
	subject?: string;
	form?: string;
	chapter?: string;
	term?: string;
	difficulty?: string;
	type?: string;
	status?: 'ready' | 'draft';
	q?: string;
}

const like = (s: string) => `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

function filterWhere(f: BankFilter) {
	return [
		f.subject ? sql`lower(${question.subject}) = lower(${f.subject})` : undefined,
		f.form ? sql`lower(${question.form}) = lower(${f.form})` : undefined,
		f.chapter ? sql`lower(${question.chapter}) = lower(${f.chapter})` : undefined,
		f.term ? eq(question.term, f.term) : undefined,
		f.difficulty ? eq(question.difficulty, f.difficulty as Difficulty) : undefined,
		f.type === 'maths'
			? isNotNull(question.template)
			: (QUESTION_TYPES as readonly string[]).includes(f.type ?? '')
				? and(eq(question.type, f.type as QuestionType), isNull(question.template))
				: undefined,
		f.q ? ilike(question.prompt, like(f.q.slice(0, 60))) : undefined
	];
}

/** The tutor's own bank questions (including those in their hand-made quizzes), newest first. */
export function listBank(db: DB, tutorId: string, f: BankFilter = {}, limit = 50, offset = 0) {
	return db
		.select()
		.from(question)
		.where(
			and(
				eq(question.tutorId, tutorId),
				f.status ? eq(question.status, f.status) : undefined,
				...filterWhere(f)
			)
		)
		.orderBy(desc(question.createdAt), desc(question.id))
		.limit(limit)
		.offset(offset);
}

/** How many of the tutor's questions match (for the list, the builder and drafts). */
export async function countBank(db: DB, tutorId: string, f: BankFilter = {}) {
	const [r] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(question)
		.where(
			and(
				eq(question.tutorId, tutorId),
				f.status ? eq(question.status, f.status) : undefined,
				...filterWhere(f)
			)
		);
	return r?.n ?? 0;
}

/** Subjects, forms and chapters in the tutor's bank (for the filters and the builder). */
export async function bankTags(db: DB, tutorId: string) {
	const rows = await db
		.select({
			subject: question.subject,
			form: question.form,
			chapter: question.chapter,
			n: sql<number>`count(*)::int`
		})
		.from(question)
		.where(and(eq(question.tutorId, tutorId), eq(question.status, 'ready')))
		.groupBy(question.subject, question.form, question.chapter)
		.orderBy(asc(question.subject), asc(question.chapter));
	const uniq = (xs: (string | null)[]) =>
		[...new Set(xs.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b));
	return {
		subjects: uniq(rows.map((r) => r.subject)),
		forms: uniq(rows.map((r) => r.form)),
		chapters: rows
			.filter((r) => r.subject && r.chapter)
			.map((r) => ({ subject: r.subject!, form: r.form, chapter: r.chapter!, n: r.n }))
	};
}

export async function getBankQuestion(db: DB, tutorId: string, id: number) {
	const [q] = await db
		.select()
		.from(question)
		.where(and(eq(question.id, id), eq(question.tutorId, tutorId)));
	return q ?? null;
}

export async function addBankQuestion(
	db: DB,
	tutorId: string,
	v: BankInput,
	opts: { origin?: 'own' | 'ai' | 'copied'; status?: 'ready' | 'draft'; copiedFrom?: number } = {}
) {
	const c = cleanBankQuestion(v);
	if ((await countBank(db, tutorId)) >= MAX_BANK) throw new TestFail('qb_err_bank_full');
	const [row] = await db
		.insert(question)
		.values({
			...c,
			tutorId,
			setId: null,
			origin: opts.origin ?? 'own',
			status: opts.status ?? 'ready',
			// AI drafts are never shared until the tutor has checked them
			shared: opts.status === 'draft' ? false : c.shared,
			copiedFrom: opts.copiedFrom ?? null
		})
		.returning();
	return row;
}

/**
 * Saves the tutor's changes. `approve` makes a draft ready (the tutor has checked it).
 * Questions inside a hand-made quiz keep their set.
 */
export async function updateBankQuestion(
	db: DB,
	tutorId: string,
	id: number,
	v: BankInput,
	approve = false
) {
	const c = cleanBankQuestion(v);
	const before = await getBankQuestion(db, tutorId, id);
	if (!before) throw new TestFail('st5_err_not_found');
	// a question inside a hand-made quiz stays multiple choice (the quiz is marked that way)
	if (before.setId && (c.type !== 'mcq' || c.template)) throw new TestFail('qb_err_in_quiz');
	const [row] = await db
		.update(question)
		.set({ ...c, ...(approve ? { status: 'ready' as const } : {}) })
		.where(and(eq(question.id, id), eq(question.tutorId, tutorId)))
		.returning();
	if (!row) throw new TestFail('st5_err_not_found');
	if (row.status === 'draft' && row.shared)
		await db.update(question).set({ shared: false }).where(eq(question.id, id));
	return row;
}

export async function removeBankQuestion(db: DB, tutorId: string, id: number) {
	await db.delete(question).where(and(eq(question.id, id), eq(question.tutorId, tutorId)));
}

export async function setShared(db: DB, tutorId: string, id: number, shared: boolean) {
	const [row] = await db
		.update(question)
		.set({ shared })
		.where(and(eq(question.id, id), eq(question.tutorId, tutorId), eq(question.status, 'ready')))
		.returning({ id: question.id });
	if (!row) throw new TestFail('st5_err_not_found');
}

/** The Tutora bank: other tutors' shared questions (not hidden by the owner). */
export function sharedBank(db: DB, tutorId: string, f: BankFilter = {}, limit = 30) {
	return db
		.select({
			id: question.id,
			type: question.type,
			prompt: question.prompt,
			choices: question.choices,
			template: question.template,
			marks: question.marks,
			subject: question.subject,
			form: question.form,
			chapter: question.chapter,
			term: question.term,
			difficulty: question.difficulty,
			by: user.name
		})
		.from(question)
		.innerJoin(user, eq(user.id, question.tutorId))
		.where(
			and(
				eq(question.shared, true),
				isNull(question.hiddenAt),
				eq(question.status, 'ready'),
				ne(question.tutorId, tutorId),
				...filterWhere({ ...f, status: undefined })
			)
		)
		.orderBy(desc(question.createdAt), desc(question.id))
		.limit(limit);
}

/** Copies a shared question into the tutor's own bank (private, theirs to change). */
export async function copyShared(db: DB, tutorId: string, id: number) {
	const [q] = await db
		.select()
		.from(question)
		.where(
			and(
				eq(question.id, id),
				eq(question.shared, true),
				isNull(question.hiddenAt),
				eq(question.status, 'ready')
			)
		);
	if (!q || q.tutorId === tutorId) throw new TestFail('st5_err_not_found');
	const [dupe] = await db
		.select({ id: question.id })
		.from(question)
		.where(and(eq(question.tutorId, tutorId), eq(question.copiedFrom, id)));
	if (dupe) return dupe;
	const [row] = await db
		.insert(question)
		.values({
			tutorId,
			setId: null,
			type: q.type,
			prompt: q.prompt,
			choices: q.choices,
			answer: q.answer,
			accepted: q.accepted,
			template: q.template,
			marks: q.marks,
			explanation: q.explanation,
			subject: q.subject,
			form: q.form,
			chapter: q.chapter,
			term: q.term,
			difficulty: q.difficulty,
			origin: 'copied',
			copiedFrom: q.id,
			shared: false
		})
		.returning({ id: question.id });
	return row;
}

/** Owner: shared questions, newest first (to hide anything that shouldn't be there). */
export function ownerSharedQuestions(db: DB, limit = 50) {
	return db
		.select({
			id: question.id,
			prompt: question.prompt,
			subject: question.subject,
			chapter: question.chapter,
			hiddenAt: question.hiddenAt,
			by: user.name,
			byId: user.id
		})
		.from(question)
		.innerJoin(user, eq(user.id, question.tutorId))
		.where(eq(question.shared, true))
		.orderBy(sql`${question.hiddenAt} is not null`, desc(question.createdAt))
		.limit(limit);
}

export async function ownerHideShared(db: DB, id: number, hide: boolean) {
	await db
		.update(question)
		.set({ hiddenAt: hide ? new Date() : null })
		.where(and(eq(question.id, id), eq(question.shared, true)));
}

/* ------------------------------------------------------------------ building a test */

export interface BuildInput {
	title: string;
	subject: string;
	form?: string | null;
	chapters: string[];
	term?: string | null;
	count: number;
	/** how many of each difficulty; the rest are filled from any difficulty */
	mix?: Partial<Record<Difficulty, number>>;
	timerMinutes?: number | null;
}

/** Fisher–Yates with a seeded random, so the same seed always gives the same order. */
export function shuffle<T>(xs: readonly T[], seed: number): T[] {
	const out = [...xs];
	const rnd = seededRandom(seed);
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(rnd() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/**
 * Picks `count` question ids at random: first the asked-for number of each difficulty, then
 * any others. Throws TestFail('qb_err_not_enough', available) when the bank hasn't enough.
 */
export function pickQuestions(
	pool: { id: number; difficulty: Difficulty | null }[],
	count: number,
	mix: Partial<Record<Difficulty, number>> = {},
	seed = (Math.random() * 2 ** 32) >>> 0
) {
	if (pool.length < count) throw new TestFail('qb_err_not_enough', pool.length);
	const shuffled = shuffle(pool, seed);
	const picked = new Set<number>();
	for (const d of DIFFICULTIES) {
		let want = Math.max(0, Math.round(mix[d] ?? 0));
		for (const q of shuffled) {
			if (!want || picked.size >= count) break;
			if (q.difficulty === d && !picked.has(q.id)) {
				picked.add(q.id);
				want--;
			}
		}
	}
	for (const q of shuffled) {
		if (picked.size >= count) break;
		picked.add(q.id);
	}
	return [...picked];
}

export async function buildTest(db: DB, tutorId: string, v: BuildInput) {
	const title = cut(v.title, 120);
	const subject = cut(v.subject, 60);
	if (!title || !subject) throw new TestFail('st5_err_set');
	const count = Math.round(Number(v.count) || 0);
	if (count < 1 || count > MAX_TEST_QUESTIONS) throw new TestFail('qb_err_count');
	const chapters = [...new Set(v.chapters.map((c) => cut(c, 80)).filter(Boolean))].slice(0, 12);
	const timer = v.timerMinutes ? Math.round(Number(v.timerMinutes)) : null;
	if (timer !== null && (!(timer >= 1) || timer > MAX_TIMER_MINUTES))
		throw new TestFail('qb_err_timer');
	const term = v.term && (TERMS as readonly string[]).includes(v.term) ? v.term : null;
	const form = cut(v.form, 40) || null;
	const pool = await db
		.select({ id: question.id, difficulty: question.difficulty })
		.from(question)
		.where(
			and(
				eq(question.tutorId, tutorId),
				eq(question.status, 'ready'),
				sql`lower(${question.subject}) = lower(${subject})`,
				form ? sql`lower(${question.form}) = lower(${form})` : undefined,
				chapters.length
					? inArray(
							sql`lower(${question.chapter})`,
							chapters.map((c) => c.toLowerCase())
						)
					: undefined
			)
		);
	const ids = pickQuestions(pool, count, v.mix ?? {});
	const [set] = await db
		.insert(questionSet)
		.values({
			tutorId,
			kind: 'test',
			title,
			subject,
			topic: (chapters.join(', ') || subject).slice(0, 80),
			level: form,
			dailyChecks: false,
			questionIds: ids,
			chapters,
			term,
			timerMinutes: timer
		})
		.returning();
	return set;
}

/** A built test's questions (the tutor's own), in the picked order. */
export async function builtQuestions(db: DB, tutorId: string, ids: number[]) {
	if (!ids.length) return [];
	const rows = await db
		.select()
		.from(question)
		.where(and(inArray(question.id, ids), eq(question.tutorId, tutorId)));
	const byQ = new Map(rows.map((r) => [r.id, r]));
	return ids.map((id) => byQ.get(id)).filter((q): q is (typeof rows)[number] => !!q);
}

/* ------------------------------------------------------------------ one student's version */

type QRow = typeof question.$inferSelect;

/** One student's copy of the questions: their order, shuffled choices, their numbers. */
export function itemsFor(
	qs: QRow[],
	assignmentId: number,
	studentId: string,
	fallbackChapter: string
) {
	const ordered = shuffle(qs, hashText(`${assignmentId}:${studentId}`));
	return ordered.map((q): AttemptItem => {
		const seed = hashText(`${assignmentId}:${studentId}:${q.id}`);
		const base = {
			qid: q.id,
			type: q.type,
			marks: q.marks,
			chapter: q.chapter || fallbackChapter,
			explanation: q.explanation,
			awarded: null,
			given: null,
			accepted: [] as string[],
			expected: null as number | null,
			decimals: 0
		};
		if (q.type === 'mcq') {
			const order = shuffle(
				q.choices.map((_, i) => i),
				seed
			);
			return {
				...base,
				prompt: q.prompt,
				choices: order.map((i) => q.choices[i]),
				answerIdx: order.indexOf(q.answer)
			};
		}
		if (q.template) {
			const v = instantiate(q.template, q.prompt, seed);
			return {
				...base,
				prompt: v.prompt,
				choices: [],
				answerIdx: 0,
				expected: v.answer,
				decimals: v.decimals
			};
		}
		return { ...base, prompt: q.prompt, choices: [], answerIdx: 0, accepted: q.accepted };
	});
}

/** Marks what can be marked automatically; written answers stay null for the tutor. */
export function markItems(items: AttemptItem[], answers: Map<number, string>): AttemptItem[] {
	return items.map((it) => {
		const given = (answers.get(it.qid) ?? '').slice(0, 4000);
		if (it.type === 'mcq') {
			const ok = /^\d$/.test(given) && Number(given) === it.answerIdx;
			return { ...it, given: given || null, awarded: ok ? it.marks : 0 };
		}
		if (it.type === 'short') {
			const ok =
				it.expected !== null
					? numberMatches(given, it.expected, it.decimals)
					: sameShortAnswer(given, it.accepted);
			return { ...it, given: given.trim() || null, awarded: ok ? it.marks : 0 };
		}
		// written: an empty answer gets 0 straight away; anything else waits for the tutor
		return { ...it, given: given.trim() || null, awarded: given.trim() ? null : 0 };
	});
}

export const totals = (items: AttemptItem[]) => ({
	score: items.reduce((s, i) => s + (i.awarded ?? 0), 0),
	maxScore: items.reduce((s, i) => s + i.marks, 0),
	toMark: items.filter((i) => i.awarded === null).length
});

/** Has the time run out (with the grace for slow networks)? */
export const isLate = (deadlineAt: Date | null, now: Date) =>
	!!deadlineAt && now.getTime() > deadlineAt.getTime() + GRACE_MS;

/** What the student may see before handing in: no answers. */
function forStudentBefore(it: AttemptItem) {
	return {
		qid: it.qid,
		type: it.type,
		prompt: it.prompt,
		choices: it.choices,
		marks: it.marks,
		chapter: it.chapter,
		numeric: it.expected !== null
	};
}

/** After handing in: their answer, the marks, and the right answer where there is one. */
function forStudentAfter(it: AttemptItem) {
	return {
		...forStudentBefore(it),
		given: it.given,
		awarded: it.awarded,
		right:
			it.type === 'mcq'
				? (it.choices[it.answerIdx] ?? null)
				: it.expected !== null
					? String(it.expected)
					: it.type === 'short'
						? (it.accepted[0] ?? null)
						: null,
		chosen: it.type === 'mcq' && it.given !== null ? (it.choices[Number(it.given)] ?? null) : null,
		explanation: it.explanation
	};
}

/* ------------------------------------------------------------------ taking a test (student) */

async function assignmentWithSet(db: DB, studentId: string, assignmentId: number) {
	const [a] = await db
		.select({ assignment: quizAssignment, set: questionSet, tutorName: user.name })
		.from(quizAssignment)
		.innerJoin(questionSet, eq(questionSet.id, quizAssignment.setId))
		.innerJoin(user, eq(user.id, questionSet.tutorId))
		.where(and(eq(quizAssignment.id, assignmentId), eq(quizAssignment.studentId, studentId)));
	return a ?? null;
}

/** Is this assignment a test built from the bank (taken with an attempt)? */
export async function isBuiltAssignment(db: DB, studentId: string, assignmentId: number) {
	const a = await assignmentWithSet(db, studentId, assignmentId);
	return !!a?.set.questionIds;
}

/**
 * Opens the student's test: the first time makes their own copy and starts the clock.
 * If the time ran out without handing in, it is closed now with what was given (nothing).
 */
export async function openAttempt(
	db: DB,
	studentId: string,
	assignmentId: number,
	now = new Date(),
	/** start: false → a timed test is only shown (questions count, time) until "Start test" */
	opts: { start?: boolean } = {}
) {
	const a = await assignmentWithSet(db, studentId, assignmentId);
	if (!a || !a.set.questionIds) return null;
	let [att] = await db.select().from(testAttempt).where(eq(testAttempt.assignmentId, assignmentId));
	const waitForStart = !att && !a.assignment.doneAt && !!a.set.timerMinutes && opts.start === false;
	if (!att && !a.assignment.doneAt && !waitForStart) {
		const qs = await builtQuestions(db, a.set.tutorId, a.set.questionIds);
		if (!qs.length) throw new TestFail('st5_err_no_questions');
		const items = itemsFor(qs, assignmentId, studentId, a.set.topic);
		const deadlineAt = a.set.timerMinutes
			? new Date(now.getTime() + a.set.timerMinutes * 60_000)
			: null;
		[att] = await db
			.insert(testAttempt)
			.values({
				assignmentId,
				studentId,
				items,
				startedAt: now,
				deadlineAt,
				maxScore: totals(items).maxScore
			})
			.onConflictDoNothing()
			.returning();
		if (!att)
			[att] = await db.select().from(testAttempt).where(eq(testAttempt.assignmentId, assignmentId));
	}
	if (att && !att.submittedAt && isLate(att.deadlineAt, now)) {
		await submitAttempt(db, studentId, assignmentId, new Map(), now, true);
		[att] = await db.select().from(testAttempt).where(eq(testAttempt.assignmentId, assignmentId));
	}
	const done = !!att?.submittedAt;
	const t = att ? totals(att.items) : null;
	return {
		/** timed and not started yet: show the "Start test" step */
		notStarted: waitForStart,
		questionCount: a.set.questionIds.length,
		id: a.assignment.id,
		title: a.set.title,
		subject: a.set.subject,
		topic: a.set.topic,
		term: a.set.term,
		tutorName: a.tutorName,
		dueOn: a.assignment.dueOn,
		timerMinutes: a.set.timerMinutes,
		startedAt: att?.startedAt ?? null,
		deadlineAt: att?.deadlineAt ?? null,
		submittedAt: att?.submittedAt ?? null,
		late: att?.late ?? false,
		autoClosed: att?.autoClosed ?? false,
		needsMarking: att?.needsMarking ?? false,
		score: done ? t!.score : null,
		maxScore: t?.maxScore ?? 0,
		toMark: done ? t!.toMark : 0,
		items: att ? (done ? att.items.map(forStudentAfter) : att.items.map(forStudentBefore)) : []
	};
}

/** Reads "a<question id>" = answer from the form (choice index or typed text). */
export function testAnswersFromForm(data: FormData): Map<number, string> {
	const out = new Map<number, string>();
	for (const [k, v] of data.entries()) {
		const id = /^a(\d{1,9})$/.exec(k)?.[1];
		if (id && typeof v === 'string') out.set(Number(id), v.slice(0, 4000));
	}
	return out;
}

/**
 * Hands in the student's test, once. Marked here; late when after the time limit (the
 * answers still count, the tutor sees "late"). Saved to progress when nothing is left to mark.
 */
export async function submitAttempt(
	db: DB,
	studentId: string,
	assignmentId: number,
	answers: Map<number, string>,
	now = new Date(),
	autoClosed = false
) {
	return db.transaction(async (tx) => {
		const t = tx as unknown as DB;
		const [att] = await t
			.select()
			.from(testAttempt)
			.where(
				and(
					eq(testAttempt.assignmentId, assignmentId),
					eq(testAttempt.studentId, studentId),
					isNull(testAttempt.submittedAt)
				)
			)
			.for('update');
		if (!att) throw new TestFail('st5_err_quiz_closed');
		const items = markItems(att.items, answers);
		const sum = totals(items);
		const late = autoClosed || isLate(att.deadlineAt, now);
		await t
			.update(testAttempt)
			.set({
				items,
				submittedAt: now,
				late,
				autoClosed,
				needsMarking: sum.toMark > 0,
				score: sum.score,
				maxScore: sum.maxScore,
				markedAt: sum.toMark ? null : now
			})
			.where(eq(testAttempt.id, att.id));
		await t.update(quizAssignment).set({ doneAt: now }).where(eq(quizAssignment.id, assignmentId));
		if (!sum.toMark) await saveResults(t, att.id, now);
		return { ...sum, late };
	});
}

/** One result per chapter for a fully marked attempt (replacing any saved before). */
async function saveResults(db: DB, attemptId: number, now: Date) {
	const [row] = await db
		.select({ att: testAttempt, set: questionSet })
		.from(testAttempt)
		.innerJoin(quizAssignment, eq(quizAssignment.id, testAttempt.assignmentId))
		.innerJoin(questionSet, eq(questionSet.id, quizAssignment.setId))
		.where(eq(testAttempt.id, attemptId));
	if (!row || !row.att.submittedAt) return;
	await db.delete(assessmentResult).where(eq(assessmentResult.attemptId, attemptId));
	const groups = new Map<string, { chapter: string; score: number; max: number }>();
	for (const it of row.att.items) {
		const key = it.chapter.toLowerCase();
		const g = groups.get(key) ?? { chapter: it.chapter, score: 0, max: 0 };
		g.score += it.awarded ?? 0;
		g.max += it.marks;
		groups.set(key, g);
	}
	for (const g of groups.values())
		await recordResult(db, {
			studentId: row.att.studentId,
			tutorId: row.set.tutorId,
			source: 'test',
			title: row.set.title,
			subject: row.set.subject,
			topic: g.chapter,
			score: g.score,
			maxScore: g.max,
			takenOn: localDate(row.att.submittedAt ?? now),
			setId: row.set.id,
			term: row.set.term,
			attemptId,
			createdBy: row.att.studentId
		});
}

/* ------------------------------------------------------------------ marking (tutor) */

/** Closes tests whose time ran out without handing in (for the tutor's lists). */
export async function closeExpired(db: DB, tutorId: string, now = new Date()) {
	const open = await db
		.select({ assignmentId: testAttempt.assignmentId, studentId: testAttempt.studentId })
		.from(testAttempt)
		.innerJoin(quizAssignment, eq(quizAssignment.id, testAttempt.assignmentId))
		.innerJoin(questionSet, eq(questionSet.id, quizAssignment.setId))
		.where(
			and(
				eq(questionSet.tutorId, tutorId),
				isNull(testAttempt.submittedAt),
				sql`${testAttempt.deadlineAt} < ${new Date(now.getTime() - GRACE_MS)}`
			)
		)
		.limit(20);
	for (const o of open)
		await submitAttempt(db, o.studentId, o.assignmentId, new Map(), now, true).catch((e) => {
			if (!(e instanceof TestFail)) throw e;
		});
}

/** Handed-in tests on the tutor's own tests: to mark first, then the latest. */
export async function markingList(db: DB, tutorId: string, limit = 40) {
	return db
		.select({
			id: testAttempt.id,
			title: questionSet.title,
			setId: questionSet.id,
			name: user.name,
			studentId: testAttempt.studentId,
			submittedAt: testAttempt.submittedAt,
			late: testAttempt.late,
			autoClosed: testAttempt.autoClosed,
			needsMarking: testAttempt.needsMarking,
			score: testAttempt.score,
			maxScore: testAttempt.maxScore
		})
		.from(testAttempt)
		.innerJoin(quizAssignment, eq(quizAssignment.id, testAttempt.assignmentId))
		.innerJoin(questionSet, eq(questionSet.id, quizAssignment.setId))
		.innerJoin(user, eq(user.id, testAttempt.studentId))
		.where(and(eq(questionSet.tutorId, tutorId), isNotNull(testAttempt.submittedAt)))
		.orderBy(desc(testAttempt.needsMarking), desc(testAttempt.submittedAt))
		.limit(limit);
}

export async function toMarkCount(db: DB, tutorId: string) {
	const [r] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(testAttempt)
		.innerJoin(quizAssignment, eq(quizAssignment.id, testAttempt.assignmentId))
		.innerJoin(questionSet, eq(questionSet.id, quizAssignment.setId))
		.where(and(eq(questionSet.tutorId, tutorId), eq(testAttempt.needsMarking, true)));
	return r?.n ?? 0;
}

/** One handed-in test on the tutor's own test, with every answer (tutor only). */
export async function attemptForTutor(db: DB, tutorId: string, attemptId: number) {
	const [r] = await db
		.select({ att: testAttempt, set: questionSet, name: user.name })
		.from(testAttempt)
		.innerJoin(quizAssignment, eq(quizAssignment.id, testAttempt.assignmentId))
		.innerJoin(questionSet, eq(questionSet.id, quizAssignment.setId))
		.innerJoin(user, eq(user.id, testAttempt.studentId))
		.where(and(eq(testAttempt.id, attemptId), eq(questionSet.tutorId, tutorId)));
	return r ?? null;
}

/**
 * The tutor marks written answers and may change any automatic mark (e.g. a short answer
 * written differently). When nothing is left to mark the scores go into progress.
 */
export async function saveMarks(
	db: DB,
	tutorId: string,
	attemptId: number,
	marks: Map<number, number>,
	now = new Date()
) {
	return db.transaction(async (tx) => {
		const t = tx as unknown as DB;
		const r = await attemptForTutor(t, tutorId, attemptId);
		if (!r || !r.att.submittedAt) throw new TestFail('st5_err_not_found');
		const items = r.att.items.map((it) => {
			const v = marks.get(it.qid);
			if (v === undefined || !Number.isFinite(v)) return it;
			return { ...it, awarded: Math.max(0, Math.min(it.marks, Math.round(v))) };
		});
		const sum = totals(items);
		await t
			.update(testAttempt)
			.set({
				items,
				needsMarking: sum.toMark > 0,
				score: sum.score,
				markedAt: sum.toMark ? null : now
			})
			.where(eq(testAttempt.id, attemptId));
		if (!sum.toMark) await saveResults(t, attemptId, now);
		return {
			...sum,
			studentId: r.att.studentId,
			title: r.set.title,
			assignmentId: r.att.assignmentId
		};
	});
}

/** Reads "m<question id>" = marks from the tutor's marking form. */
export function marksFromForm(data: FormData): Map<number, number> {
	const out = new Map<number, number>();
	for (const [k, v] of data.entries()) {
		const id = /^m(\d{1,9})$/.exec(k)?.[1];
		if (id && typeof v === 'string' && /^\d{1,2}$/.test(v.trim())) out.set(Number(id), Number(v));
	}
	return out;
}

/* ------------------------------------------------------------------ scores from elsewhere */

export const OUTSIDE_SOURCES = ['google_forms', 'kahoot', 'test'] as const;

/** A score from Google Forms, Kahoot! or a paper test, for one of the tutor's students. */
export async function enterOutsideScore(
	db: DB,
	tutorId: string,
	v: {
		studentId: string;
		source: string;
		title: string;
		subject: string;
		chapter: string;
		term?: string | null;
		score: number;
		maxScore: number;
		takenOn?: string | null;
	}
) {
	const source = (OUTSIDE_SOURCES as readonly string[]).includes(v.source)
		? (v.source as (typeof OUTSIDE_SOURCES)[number])
		: 'test';
	const subject = cut(v.subject, 60);
	const chapter = cut(v.chapter, 80);
	if (!subject || !chapter) throw new TestFail('qb_err_tags');
	const max = Math.round(Number(v.maxScore));
	const score = Math.round(Number(v.score));
	if (!(max >= 1 && max <= 1000) || !(score >= 0) || score > max)
		throw new TestFail('tut3_err_score_max');
	const today = localDate(new Date());
	const takenOn = v.takenOn && /^\d{4}-\d{2}-\d{2}$/.test(v.takenOn) ? v.takenOn : today;
	if (takenOn > today) throw new TestFail('err_times');
	const [mine] = await db
		.select({ id: user.id })
		.from(enrollment)
		.innerJoin(user, eq(user.id, enrollment.userId))
		.where(
			and(
				eq(enrollment.tutorId, tutorId),
				eq(enrollment.userId, v.studentId),
				eq(user.role, 'student')
			)
		);
	if (!mine) throw new TestFail('st5_err_not_student');
	return recordResult(db, {
		studentId: v.studentId,
		tutorId,
		source,
		title: cut(v.title, 120) || chapter,
		subject,
		topic: chapter,
		score,
		maxScore: max,
		takenOn,
		term: v.term && (TERMS as readonly string[]).includes(v.term) ? v.term : null,
		createdBy: tutorId
	});
}

/* ------------------------------------------------------------------ scores per chapter and term */

/** The school term of a date when none was given (Zimbabwe: Jan–Apr, May–Aug, Sep–Dec). */
export const termOf = (isoDate: string) => {
	const mth = Number(isoDate.slice(5, 7));
	return mth <= 4 ? 'Term 1' : mth <= 8 ? 'Term 2' : 'Term 3';
};

export interface ChapterScore {
	subject: string;
	chapter: string;
	pct: number;
	tests: number;
	lastOn: string;
}
export interface TermScore {
	/** "Term 1 2026" */
	term: string;
	pct: number;
	tests: number;
}

const TEST_SOURCES = ['test', 'quiz', 'kahoot', 'google_forms'] as const;

/**
 * Test scores (tests, quizzes, Kahoot!, Google Forms) per chapter and per school term,
 * between two dates (inclusive; ISO yyyy-mm-dd). For progress, parent reports and the
 * stored reports. Averages are total marks / total possible, 0–100.
 */
export async function testScoresFor(
	db: DB,
	studentId: string,
	from?: string | null,
	to?: string | null
): Promise<{ chapters: ChapterScore[]; terms: TermScore[] }> {
	const rows = await db
		.select({
			subject: assessmentResult.subject,
			topic: assessmentResult.topic,
			score: assessmentResult.score,
			maxScore: assessmentResult.maxScore,
			takenOn: assessmentResult.takenOn,
			term: assessmentResult.term
		})
		.from(assessmentResult)
		.where(
			and(
				eq(assessmentResult.studentId, studentId),
				inArray(assessmentResult.source, [...TEST_SOURCES]),
				from ? sql`${assessmentResult.takenOn} >= ${from}` : undefined,
				to ? sql`${assessmentResult.takenOn} <= ${to}` : undefined
			)
		)
		.orderBy(desc(assessmentResult.takenOn))
		.limit(1000);
	const ch = new Map<string, ChapterScore & { s: number; m: number }>();
	const tm = new Map<string, TermScore & { s: number; m: number; sort: string }>();
	for (const r of rows) {
		const k = `${r.subject.toLowerCase()}|${r.topic.toLowerCase()}`;
		const c = ch.get(k) ?? {
			subject: r.subject,
			chapter: r.topic,
			pct: 0,
			tests: 0,
			lastOn: r.takenOn,
			s: 0,
			m: 0
		};
		c.s += r.score;
		c.m += r.maxScore;
		c.tests++;
		ch.set(k, c);
		const label = `${r.term || termOf(r.takenOn)} ${r.takenOn.slice(0, 4)}`;
		const t = tm.get(label) ?? {
			term: label,
			pct: 0,
			tests: 0,
			s: 0,
			m: 0,
			sort: `${r.takenOn.slice(0, 4)}${label.slice(5, 6)}`
		};
		t.s += r.score;
		t.m += r.maxScore;
		t.tests++;
		tm.set(label, t);
	}
	const p = (s: number, m: number) => (m > 0 ? Math.round((100 * s) / m) : 0);
	return {
		chapters: [...ch.values()]
			.map(({ s, m, ...c }) => ({ ...c, pct: p(s, m) }))
			.sort((a, b) => a.subject.localeCompare(b.subject) || a.chapter.localeCompare(b.chapter)),
		terms: [...tm.values()]
			.sort((a, b) => b.sort.localeCompare(a.sort))
			.map(({ s, m, sort: _sort, ...t }) => ({ ...t, pct: p(s, m) }))
	};
}

/** The student's built tests waiting (for lists): open and not yet started or still running. */
export function openTestsFor(db: DB, studentId: string) {
	return db
		.select({ id: quizAssignment.id, title: questionSet.title, dueOn: quizAssignment.dueOn })
		.from(quizAssignment)
		.innerJoin(questionSet, eq(questionSet.id, quizAssignment.setId))
		.where(
			and(
				eq(quizAssignment.studentId, studentId),
				isNull(quizAssignment.doneAt),
				isNotNull(questionSet.questionIds)
			)
		);
}
