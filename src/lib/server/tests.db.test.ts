import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { freshDb, hasTestDb } from './testing/db.ts';
import { makeUser } from './testing/fixtures.ts';
import type { DB } from './db/types.ts';
import { assessmentResult, question, quizAssignment } from './db/v3.schema.ts';
import { aiUsage, testAttempt } from './db/tests.schema.ts';
import { assignSet, dailyCheck } from './assessments.ts';
import {
	addBankQuestion,
	buildTest,
	cleanBankQuestion,
	closeExpired,
	copyShared,
	enterOutsideScore,
	itemsFor,
	markItems,
	openAttempt,
	ownerHideShared,
	pickQuestions,
	sameShortAnswer,
	saveMarks,
	setShared,
	sharedBank,
	shuffle,
	submitAttempt,
	termOf,
	testScoresFor,
	TestFail,
	totals,
	updateBankQuestion,
	type BankInput
} from './tests.ts';
import {
	AI_STOP_LIVE,
	AI_STOP_TEST,
	AI_TUTOR_CAP,
	aiToday,
	makeDrafts,
	parseDrafts,
	reserveNeurons,
	type AiBinding
} from './ai-tests.ts';

const mcq = (over: Partial<BankInput> = {}): BankInput => ({
	type: 'mcq',
	prompt: 'What is 3/4 as a decimal?',
	choices: ['0.75', '0.34', '7.5'],
	answer: 0,
	subject: 'Maths',
	form: 'Form 2',
	chapter: 'Fractions',
	term: 'Term 1',
	difficulty: 'easy',
	...over
});

describe('question bank and tests (no database)', () => {
	it('checks each kind of question', () => {
		expect(cleanBankQuestion(mcq({ choices: ['', 'a', 'b'], answer: 2 }))).toMatchObject({
			type: 'mcq',
			choices: ['a', 'b'],
			answer: 1
		});
		expect(() => cleanBankQuestion(mcq({ chapter: ' ' }))).toThrow(TestFail);
		expect(() => cleanBankQuestion({ ...mcq(), type: 'short', accepted: [' '] })).toThrow(TestFail);
		expect(
			cleanBankQuestion({ ...mcq(), type: 'short', accepted: ['Harare', 'harare', ' '] }).accepted
		).toEqual(['Harare', 'harare']);
		expect(cleanBankQuestion({ ...mcq(), type: 'written' })).toMatchObject({ type: 'written' });
		const maths = cleanBankQuestion({
			...mcq(),
			type: 'maths',
			prompt: '{a} + {b} = ?',
			template: { vars: { a: { min: 1, max: 9 }, b: { min: 1, max: 9 } }, answer: 'a + b' }
		});
		expect(maths.type).toBe('short');
		expect(maths.template?.answer).toBe('a + b');
		expect(() =>
			cleanBankQuestion({ ...mcq(), type: 'maths', prompt: '{a}', template: null })
		).toThrow(TestFail);
	});

	it('marks short answers without minding capitals, spaces or a full stop', () => {
		expect(sameShortAnswer('  harare. ', ['Harare'])).toBe(true);
		expect(sameShortAnswer('photo synthesis', ['photosynthesis'])).toBe(true);
		expect(sameShortAnswer('Bulawayo', ['Harare'])).toBe(false);
		expect(sameShortAnswer('', ['Harare'])).toBe(false);
	});

	it('shuffles the same way for the same seed, differently for others', () => {
		const xs = Array.from({ length: 12 }, (_, i) => i);
		expect(shuffle(xs, 42)).toEqual(shuffle(xs, 42));
		expect(shuffle(xs, 42)).not.toEqual(shuffle(xs, 43));
		expect([...shuffle(xs, 42)].sort((a, b) => a - b)).toEqual(xs);
	});

	it('picks the difficulty mix first, then any others, never twice', () => {
		const pool = [
			...Array.from({ length: 5 }, (_, i) => ({ id: i + 1, difficulty: 'easy' as const })),
			...Array.from({ length: 5 }, (_, i) => ({ id: i + 11, difficulty: 'hard' as const }))
		];
		const ids = pickQuestions(pool, 6, { hard: 4 }, 7);
		expect(new Set(ids).size).toBe(6);
		expect(ids.filter((id) => id > 10).length).toBeGreaterThanOrEqual(4);
		expect(() => pickQuestions(pool, 11)).toThrow(TestFail);
	});

	it('marks each type: mcq and short and maths automatically, written by the tutor', () => {
		const base = { id: 0, setId: null, tutorId: 't', explanation: null, sortOrder: 0 };
		const rows = [
			{ ...cleanBankQuestion(mcq()), ...base, id: 1 },
			{ ...cleanBankQuestion({ ...mcq(), type: 'short', accepted: ['Harare'] }), ...base, id: 2 },
			{ ...cleanBankQuestion({ ...mcq(), type: 'written', marks: 4 }), ...base, id: 3 },
			{
				...cleanBankQuestion({
					...mcq(),
					type: 'maths',
					prompt: '{a} × {b}',
					template: { vars: { a: { min: 2, max: 9 }, b: { min: 2, max: 9 } }, answer: 'a * b' }
				}),
				...base,
				id: 4
			}
		] as unknown as Parameters<typeof itemsFor>[0];
		const items = itemsFor(rows, 5, 'stu', 'Fractions');
		const byQ = new Map(items.map((i) => [i.qid, i]));
		const right = new Map([
			[1, String(byQ.get(1)!.answerIdx)],
			[2, 'harare'],
			[3, 'Because the denominators are the same.'],
			[4, String(byQ.get(4)!.expected)]
		]);
		const marked = markItems(items, right);
		const t = totals(marked);
		expect(t).toEqual({ score: 3, maxScore: 7, toMark: 1 });
		const wrong = markItems(items, new Map([[1, String((byQ.get(1)!.answerIdx + 1) % 3)]]));
		expect(totals(wrong)).toEqual({ score: 0, maxScore: 7, toMark: 0 }); // empty written = 0
	});

	it('works out the school term from the date', () => {
		expect(termOf('2026-02-10')).toBe('Term 1');
		expect(termOf('2026-06-01')).toBe('Term 2');
		expect(termOf('2026-11-16')).toBe('Term 3');
	});

	it('reads only valid questions from the model, whatever it wraps them in', () => {
		const good = parseDrafts(
			'Sure! ```json\n{"questions":[{"type":"mcq","prompt":"2+2?","choices":["3","4"],"answer":1},' +
				'{"type":"mcq","prompt":"bad","choices":["x"],"answer":0},' +
				'{"type":"short","prompt":"Capital?","answers":["Harare"]},' +
				'{"type":"written","prompt":"Explain."},{"type":"mcq","prompt":"Letter","choices":["a","b"],"answer":"B"},' +
				'{"type":"weird","prompt":"?"}]}\n```'
		);
		expect(good.map((q) => q.type)).toEqual(['mcq', 'short', 'written', 'mcq']);
		expect(good[3].answer).toBe(1);
		expect(parseDrafts('not json at all')).toEqual([]);
		expect(parseDrafts(null)).toEqual([]);
		expect(parseDrafts('[{"type":"short","prompt":"x","answers":[]}]')).toEqual([]);
		expect(
			parseDrafts(
				JSON.stringify({ questions: Array(30).fill({ type: 'written', prompt: 'p' }) }),
				5
			)
		).toHaveLength(5);
	});
});

describe.skipIf(!hasTestDb)('question bank and tests (database)', () => {
	let db: DB;
	let close: () => Promise<void>;
	let tutorA: Awaited<ReturnType<typeof makeUser>>;
	let tutorB: Awaited<ReturnType<typeof makeUser>>;
	let amina: Awaited<ReturnType<typeof makeUser>>;
	let tino: Awaited<ReturnType<typeof makeUser>>;
	const now = new Date('2026-11-16T08:00:00Z');

	beforeAll(async () => {
		({ db, close } = await freshDb());
		tutorB = await makeUser(db, 'tutor', 'Tutor B');
		tutorA = await makeUser(db, 'tutor', 'Tutor A');
		amina = await makeUser(db, 'student', 'Amina Dube');
		tino = await makeUser(db, 'student', 'Tino Moyo');
		for (let i = 0; i < 6; i++)
			await addBankQuestion(
				db,
				tutorA.id,
				mcq({ prompt: `Fractions ${i}`, choices: ['r', 'w1', 'w2', 'w3'], answer: 0 })
			);
		for (let i = 0; i < 3; i++)
			await addBankQuestion(db, tutorA.id, mcq({ prompt: `Ratio ${i}`, chapter: 'Ratio' }));
		await addBankQuestion(db, tutorA.id, {
			...mcq(),
			type: 'written',
			prompt: 'Explain ratio.',
			chapter: 'Ratio',
			marks: 3
		});
	});
	afterAll(async () => close?.());

	it('keeps questions private until shared; others can copy, the owner can hide', async () => {
		const [q] = await db.select().from(question).where(eq(question.prompt, 'Ratio 0'));
		expect(await sharedBank(db, tutorB.id)).toEqual([]);
		await setShared(db, tutorA.id, q.id, true);
		await expect(setShared(db, tutorB.id, q.id, false)).rejects.toThrow(TestFail);
		const seen = await sharedBank(db, tutorB.id, { subject: 'maths' });
		expect(seen.map((s) => s.id)).toEqual([q.id]);
		expect(JSON.stringify(seen)).not.toContain('"answer"');
		const copy = await copyShared(db, tutorB.id, q.id);
		expect((await copyShared(db, tutorB.id, q.id)).id).toBe(copy.id); // not twice
		await expect(copyShared(db, tutorA.id, q.id)).rejects.toThrow(TestFail); // own question
		await ownerHideShared(db, q.id, true);
		expect(await sharedBank(db, tutorB.id)).toEqual([]);
		await ownerHideShared(db, q.id, false);
		// a tutor can't edit another tutor's question
		await expect(updateBankQuestion(db, tutorB.id, q.id, mcq())).rejects.toThrow(TestFail);
	});

	it('builds a test from the chapters asked for, and each student gets their own order', async () => {
		await expect(
			buildTest(db, tutorA.id, { title: 'T', subject: 'Maths', chapters: ['Fractions'], count: 7 })
		).rejects.toThrow(TestFail);
		const set = await buildTest(db, tutorA.id, {
			title: 'Fractions test',
			subject: 'maths',
			form: 'Form 2',
			chapters: ['fractions'],
			term: 'Term 3',
			count: 6,
			timerMinutes: 20
		});
		expect(set.questionIds).toHaveLength(6);
		const a = await assignSet(db, tutorA.id, set.id, amina.id, null);
		const b = await assignSet(db, tutorA.id, set.id, tino.id, null);
		const ta = await openAttempt(db, amina.id, a.assignment.id, now);
		const tb = await openAttempt(db, tino.id, b.assignment.id, now);
		expect(ta!.items.map((i) => i.qid)).not.toEqual(tb!.items.map((i) => i.qid));
		expect([...ta!.items.map((i) => i.qid)].sort()).toEqual(
			[...tb!.items.map((i) => i.qid)].sort()
		);
		// reopening gives the same order; nothing about answers reaches the student
		expect((await openAttempt(db, amina.id, a.assignment.id, now))!.items).toEqual(ta!.items);
		expect(JSON.stringify(ta)).not.toContain('answerIdx');
		expect(ta!.deadlineAt?.getTime()).toBe(now.getTime() + 20 * 60_000);
		// another student can't open it
		expect(await openAttempt(db, tino.id, a.assignment.id, now)).toBeNull();
		// built tests never feed the daily check (no set questions)
		const check = await dailyCheck(db, amina.id, 'test-secret-test-secret-test-secret-123', now);
		expect(check.questions.every((q) => !set.questionIds!.includes(q.id))).toBe(true);
	});

	it('marks a timed test on time, late after the limit, and closes it when time ran out', async () => {
		const set = await buildTest(db, tutorA.id, {
			title: 'Quick',
			subject: 'Maths',
			chapters: ['Fractions'],
			count: 2,
			timerMinutes: 5
		});
		const a = await assignSet(db, tutorA.id, set.id, amina.id, null);
		const b = await assignSet(db, tutorA.id, set.id, tino.id, null);
		const open = await openAttempt(db, amina.id, a.assignment.id, now);
		const [att] = await db
			.select()
			.from(testAttempt)
			.where(eq(testAttempt.assignmentId, a.assignment.id));
		const answers = new Map(att.items.map((i) => [i.qid, String(i.answerIdx)]));
		expect(open!.items).toHaveLength(2);
		const late = await submitAttempt(
			db,
			amina.id,
			a.assignment.id,
			answers,
			new Date(now.getTime() + 7 * 60_000)
		);
		expect(late).toMatchObject({ score: 2, maxScore: 2, late: true });
		await expect(submitAttempt(db, amina.id, a.assignment.id, answers)).rejects.toThrow(TestFail);
		// Tino opens it and never hands in: closed at the deadline, with 0
		await openAttempt(db, tino.id, b.assignment.id, now);
		await closeExpired(db, tutorA.id, new Date(now.getTime() + 10 * 60_000));
		const [tb] = await db
			.select()
			.from(testAttempt)
			.where(eq(testAttempt.assignmentId, b.assignment.id));
		expect(tb).toMatchObject({ autoClosed: true, late: true, score: 0 });
		const [done] = await db
			.select()
			.from(quizAssignment)
			.where(eq(quizAssignment.id, b.assignment.id));
		expect(done.doneAt).not.toBeNull();
	});

	it('waits for the tutor to mark written answers, then saves a score per chapter and term', async () => {
		const set = await buildTest(db, tutorA.id, {
			title: 'Ratio test',
			subject: 'Maths',
			chapters: ['Ratio', 'Fractions'],
			term: 'Term 3',
			count: 10
		});
		const { assignment } = await assignSet(db, tutorA.id, set.id, amina.id, null);
		await openAttempt(db, amina.id, assignment.id, now);
		const [att] = await db
			.select()
			.from(testAttempt)
			.where(eq(testAttempt.assignmentId, assignment.id));
		const answers = new Map(
			att.items.map((i) => [
				i.qid,
				i.type === 'written' ? 'A ratio compares two amounts.' : String(i.answerIdx)
			])
		);
		const r = await submitAttempt(db, amina.id, assignment.id, answers, now);
		expect(r.toMark).toBe(1);
		const before = await db
			.select()
			.from(assessmentResult)
			.where(eq(assessmentResult.attemptId, att.id));
		expect(before).toEqual([]); // nothing in progress until marked
		const written = att.items.find((i) => i.type === 'written')!;
		await expect(saveMarks(db, tutorB.id, att.id, new Map([[written.qid, 3]]))).rejects.toThrow(
			TestFail
		);
		const m = await saveMarks(db, tutorA.id, att.id, new Map([[written.qid, 2]]), now);
		expect(m).toMatchObject({ score: 11, maxScore: 12, toMark: 0 });
		const results = await db
			.select()
			.from(assessmentResult)
			.where(eq(assessmentResult.attemptId, att.id));
		expect(results.map((x) => [x.topic, x.score, x.maxScore, x.term]).sort()).toEqual([
			['Fractions', 6, 6, 'Term 3'],
			['Ratio', 5, 6, 'Term 3']
		]);
		// re-marking replaces the scores, never doubles them
		await saveMarks(db, tutorA.id, att.id, new Map([[written.qid, 3]]), now);
		const again = await db
			.select()
			.from(assessmentResult)
			.where(eq(assessmentResult.attemptId, att.id));
		expect(again.reduce((s, x) => s + x.score, 0)).toBe(12);
		const scores = await testScoresFor(db, amina.id, '2026-11-01', '2026-11-30');
		expect(scores.chapters.find((c) => c.chapter === 'Ratio')).toMatchObject({ pct: 100 });
		expect(scores.terms[0].term).toBe('Term 3 2026');
	});

	it('takes scores from Google Forms or Kahoot! for the tutor’s own students only', async () => {
		const outsider = await makeUser(db, 'student', 'Not mine', tutorB.id);
		const base = {
			source: 'google_forms',
			title: 'Quiz',
			subject: 'Maths',
			chapter: 'Algebra',
			score: 8,
			maxScore: 10,
			takenOn: '2026-11-10'
		};
		const row = await enterOutsideScore(db, tutorA.id, { ...base, studentId: tino.id });
		expect(row).toMatchObject({ source: 'google_forms', topic: 'Algebra', score: 8 });
		await expect(
			enterOutsideScore(db, tutorA.id, { ...base, studentId: outsider.id })
		).rejects.toThrow(TestFail);
		await expect(
			enterOutsideScore(db, tutorA.id, { ...base, studentId: tino.id, score: 11 })
		).rejects.toThrow(TestFail);
		const s = await testScoresFor(db, tino.id);
		expect(s.chapters.find((c) => c.chapter === 'Algebra')?.pct).toBe(80);
	});

	it('AI: counts before each call, stops at the line and at the per-tutor cap', async () => {
		const day = new Date('2026-11-17T09:00:00Z');
		const line = AI_STOP_LIVE;
		expect(await reserveNeurons(db, tutorA.id, AI_TUTOR_CAP + 1, line, day)).toBe('tutor_cap');
		expect(await reserveNeurons(db, tutorA.id, AI_TUTOR_CAP - 100, line, day)).toBe('ok');
		expect(await reserveNeurons(db, tutorA.id, 200, line, day)).toBe('tutor_cap');
		// other tutors still have room until the site's line (80% of the free allowance)
		await db
			.insert(aiUsage)
			.values({ day: '2026-11-17', tutorId: tutorB.id, neurons: line - AI_TUTOR_CAP });
		const tutorC = await makeUser(db, 'tutor', 'Tutor C');
		expect(await reserveNeurons(db, tutorC.id, 50, line, day)).toBe('ok');
		expect(await reserveNeurons(db, tutorC.id, 60, line, day)).toBe('resting');
		expect((await aiToday(db, tutorA.id, day)).mine).toBe(AI_TUTOR_CAP - 100);
		expect((await aiToday(db, null, day)).neurons).toBeLessThanOrEqual(line);
		// the test site has its own, smaller line
		expect(
			await reserveNeurons(
				db,
				tutorA.id,
				AI_STOP_TEST + 1,
				AI_STOP_TEST,
				new Date('2026-11-19T01:00:00Z')
			)
		).toBe('resting');
		// a new UTC day starts again
		expect(
			await reserveNeurons(db, tutorA.id, 100, AI_STOP_TEST, new Date('2026-11-18T00:01:00Z'))
		).toBe('ok');
	});

	it('AI: drafts land in the bank as drafts; no AI or no room means no call', async () => {
		let calls = 0;
		const fake: AiBinding = {
			async run() {
				calls++;
				return {
					response: JSON.stringify({
						questions: [
							{ type: 'mcq', prompt: 'Which is a prime?', choices: ['4', '7', '9'], answer: 1 },
							{ type: 'short', prompt: '2 x 6?', answers: ['12'] }
						]
					}),
					usage: { prompt_tokens: 300, completion_tokens: 200 }
				};
			}
		};
		const input = {
			notes: 'Prime numbers have exactly two factors.',
			subject: 'Maths',
			chapter: 'Primes',
			count: 2,
			type: 'mixed' as const
		};
		const day = new Date('2026-11-20T09:00:00Z');
		const r = await makeDrafts(db, fake, tutorA.id, input, { testSite: true, now: day });
		expect(r).toEqual({ ok: true, drafts: 2 });
		const drafts = await db
			.select()
			.from(question)
			.where(and(eq(question.tutorId, tutorA.id), eq(question.chapter, 'Primes')));
		expect(drafts.map((d) => [d.status, d.origin, d.shared])).toEqual([
			['draft', 'ai', false],
			['draft', 'ai', false]
		]);
		// drafts are never picked for a test until checked
		await expect(
			buildTest(db, tutorA.id, { title: 'P', subject: 'Maths', chapters: ['Primes'], count: 1 })
		).rejects.toThrow(TestFail);
		await updateBankQuestion(
			db,
			tutorA.id,
			drafts[0].id,
			{
				type: 'mcq',
				prompt: drafts[0].prompt,
				choices: drafts[0].choices,
				answer: drafts[0].answer,
				subject: 'Maths',
				chapter: 'Primes'
			},
			true
		);
		expect(
			(
				await buildTest(db, tutorA.id, {
					title: 'P',
					subject: 'Maths',
					chapters: ['Primes'],
					count: 1
				})
			).questionIds
		).toEqual([drafts[0].id]);
		expect(await makeDrafts(db, null, tutorA.id, input, { testSite: true, now: day })).toEqual({
			ok: false,
			reason: 'unavailable'
		});
		// at the line: resting, and the model is not called
		await db
			.insert(aiUsage)
			.values({ day: '2026-11-21', tutorId: tutorB.id, neurons: AI_STOP_TEST });
		const before = calls;
		expect(
			await makeDrafts(db, fake, tutorA.id, input, {
				testSite: true,
				now: new Date('2026-11-21T10:00:00Z')
			})
		).toEqual({ ok: false, reason: 'resting' });
		expect(calls).toBe(before);
	});
});
