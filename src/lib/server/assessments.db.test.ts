import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { freshDb, hasTestDb } from './testing/db.ts';
import { makeUser, zw } from './testing/fixtures.ts';
import type { DB } from './db/types.ts';
import { assessmentResult, familyLink, quizAssignment, studyAlertSent } from './db/v3.schema.ts';
import {
	AssessFail,
	addQuestion,
	assignSet,
	assignmentToTake,
	chooseForCheck,
	cleanQuestion,
	createSet,
	dailyCheck,
	readCheck,
	signCheck,
	submitAssignment,
	submitDailyCheck,
	updateQuestion
} from './assessments.ts';
import {
	addPlanItem,
	clock12,
	clockShort,
	endSession,
	startSession,
	tellFamilyStudy
} from './study.ts';
import { sendStudyReminders } from './reminders.ts';
import { addDays, localDate } from '../tz.ts';

const SECRET = 'test-secret-test-secret-test-secret-123';

describe('questions and picking (no database)', () => {
	it('keeps 2–5 filled-in choices and moves the answer index with them', () => {
		const q = cleanQuestion({
			prompt: ' 1/2 + 1/4? ',
			choices: ['', '3/4', ' ', '2/6', ''],
			answer: 1
		});
		expect(q).toEqual({
			prompt: '1/2 + 1/4?',
			choices: ['3/4', '2/6'],
			answer: 0,
			explanation: null
		});
		expect(() => cleanQuestion({ prompt: 'x', choices: ['a', '', ''], answer: 0 })).toThrow(
			AssessFail
		);
		expect(() => cleanQuestion({ prompt: 'x', choices: ['a', 'b', ''], answer: 2 })).toThrow(
			AssessFail
		);
		expect(() => cleanQuestion({ prompt: '', choices: ['a', 'b'], answer: 0 })).toThrow(AssessFail);
	});

	it('never repeats a question within 7 checks when there are enough questions', () => {
		const pref = Array.from({ length: 9 }, (_, i) => i + 1);
		const other = Array.from({ length: 40 }, (_, i) => 100 + i);
		const days = Array.from({ length: 30 }, (_, c) => chooseForCheck(pref, other, c));
		for (const d of days) {
			expect(d).toHaveLength(5);
			expect(new Set(d).size).toBe(5);
		}
		for (let c = 0; c + 7 <= days.length; c++) {
			const week = days.slice(c, c + 7).flat();
			expect(new Set(week).size).toBe(week.length);
		}
		// the preferred topics come up every week
		expect(
			days
				.slice(0, 7)
				.flat()
				.filter((q) => q < 100)
		).toHaveLength(9);
	});

	it('uses what there is when there are only a few questions', () => {
		expect(chooseForCheck([1, 2], [], 0)).toEqual([1, 2]);
		expect(chooseForCheck([], [7, 8, 9], 3).sort()).toEqual([7, 8, 9]);
		expect(chooseForCheck([], [], 0)).toEqual([]);
	});

	it('12-hour times for families', () => {
		expect(clock12(16 * 60)).toBe('4:00 PM');
		expect(clockShort(16 * 60 + 45)).toBe('4:45');
		expect(clock12(30)).toBe('12:30 AM');
	});
});

describe.skipIf(!hasTestDb)('assessments, daily checks and study alerts', () => {
	let db: DB;
	let close: () => Promise<void>;
	const now = zw(0, '15:10'); // Monday
	let tutorA: Awaited<ReturnType<typeof makeUser>>;
	let tutorB: Awaited<ReturnType<typeof makeUser>>;
	let amina: Awaited<ReturnType<typeof makeUser>>;
	let tino: Awaited<ReturnType<typeof makeUser>>;
	let other: Awaited<ReturnType<typeof makeUser>>;
	let fractions: number;
	let ratio: number;
	let closed: number;
	let bSet: number;
	const qIds = new Map<number, number[]>();
	/** correct answers, by question id */
	const key = new Map<number, number>();

	async function makeSet(
		tutorId: string,
		topic: string,
		daily: boolean,
		n: number,
		kind: 'quiz' | 'test' = 'quiz'
	) {
		const s = await createSet(db, tutorId, {
			kind,
			title: `${topic} ${kind}`,
			subject: 'Maths',
			topic,
			dailyChecks: daily
		});
		const ids: number[] = [];
		for (let i = 0; i < n; i++) {
			const q = await addQuestion(db, tutorId, s.id, {
				prompt: `${topic} question ${i + 1}`,
				choices: ['a', 'b', 'c'],
				answer: i % 3,
				explanation: 'Because.'
			});
			ids.push(q.id);
			key.set(q.id, i % 3);
		}
		qIds.set(s.id, ids);
		return s.id;
	}

	beforeAll(async () => {
		({ db, close } = await freshDb());
		tutorB = await makeUser(db, 'tutor', 'Tutor B');
		other = await makeUser(db, 'student', 'Other Student'); // enrolled with B only
		tutorA = await makeUser(db, 'tutor', 'Tutor A');
		amina = await makeUser(db, 'student', 'Amina Dube'); // enrolled with A
		tino = await makeUser(db, 'student', 'Tino Moyo'); // enrolled with A
		fractions = await makeSet(tutorA.id, 'Fractions', true, 3);
		ratio = await makeSet(tutorA.id, 'Ratio', true, 2);
		closed = await makeSet(tutorA.id, 'Algebra', false, 4);
		bSet = await makeSet(tutorB.id, 'Geometry', true, 3);
	});
	afterAll(async () => close?.());

	const all = (ids: number[], right = true) =>
		new Map(ids.map((id) => [id, right ? key.get(id)! : (key.get(id)! + 1) % 3]));

	it('a tutor only edits their own questions', async () => {
		const [q] = qIds.get(fractions)!;
		await expect(
			updateQuestion(db, tutorB.id, q, { prompt: 'hacked', choices: ['x', 'y'], answer: 0 })
		).rejects.toThrow(AssessFail);
		await expect(
			addQuestion(db, tutorB.id, fractions, { prompt: 'x', choices: ['x', 'y'], answer: 0 })
		).rejects.toThrow(AssessFail);
	});

	it('the daily check only uses daily-check sets of tutors the student is enrolled with', async () => {
		const c = await dailyCheck(db, amina.id, SECRET, now);
		expect(c.done).toBeNull();
		const ids = c.questions.map((q) => q.id).sort((a, b) => a - b);
		expect(ids).toEqual([...qIds.get(fractions)!, ...qIds.get(ratio)!].sort((a, b) => a - b));
		// answers never go to the browser
		expect(JSON.stringify(c.questions)).not.toContain('"answer"');
		expect(JSON.stringify(c.questions)).not.toContain('Because.');
		// a student with no tutors' questions gets the empty state
		const lonely = await makeUser(db, 'student', 'Lonely', null);
		expect((await dailyCheck(db, lonely.id, SECRET, now)).questions).toEqual([]);
	});

	it('rejects tampered, foreign and old question lists', async () => {
		const c = await dailyCheck(db, amina.id, SECRET, now);
		const ids = c.questions.map((q) => q.id);
		const answers = all(ids);
		// swapped in another question, keeping the signature
		const [date, list, sig] = c.token!.split('.');
		const swapped = `${date}.${[...list.split('-').slice(1), qIds.get(closed)![0]].join('-')}.${sig}`;
		await expect(submitDailyCheck(db, amina.id, SECRET, swapped, answers, now)).rejects.toThrow(
			'st5_err_check_old'
		);
		// another student's token
		const tinos = await dailyCheck(db, tino.id, SECRET, now);
		await expect(
			submitDailyCheck(db, amina.id, SECRET, tinos.token!, answers, now)
		).rejects.toThrow('st5_err_check_old');
		// properly signed, but questions from a tutor she isn't enrolled with / a closed set
		for (const bad of [qIds.get(bSet)!, qIds.get(closed)!]) {
			const forged = await signCheck(SECRET, amina.id, localDate(now), bad);
			await expect(submitDailyCheck(db, amina.id, SECRET, forged, all(bad), now)).rejects.toThrow(
				'st5_err_check_old'
			);
		}
		// yesterday's list
		const old = await signCheck(SECRET, amina.id, localDate(addDays(now, -1)), ids);
		await expect(submitDailyCheck(db, amina.id, SECRET, old, answers, now)).rejects.toThrow(
			'st5_err_check_old'
		);
		expect(await readCheck('another-secret-another-secret-123', amina.id, c.token!)).toBeNull();
		const saved = await db
			.select()
			.from(assessmentResult)
			.where(eq(assessmentResult.studentId, amina.id));
		expect(saved).toHaveLength(0);
	});

	it('marks on the server, saves one result per topic, once a day', async () => {
		const c = await dailyCheck(db, amina.id, SECRET, now);
		const ids = c.questions.map((q) => q.id);
		// two right about fractions, everything else wrong; a nonsense answer counts as no answer
		const answers = all(ids, false);
		const [f1, f2] = qIds.get(fractions)!;
		answers.set(f1, key.get(f1)!);
		answers.set(f2, key.get(f2)!);
		answers.set(qIds.get(ratio)![0], 9);
		const r = await submitDailyCheck(db, amina.id, SECRET, c.token!, answers, now);
		expect(r).toMatchObject({ score: 2, maxScore: 5 });
		expect(r.review.find((x) => x.id === f1)).toMatchObject({
			correct: true,
			explanation: 'Because.'
		});
		expect(r.review.find((x) => x.id === qIds.get(ratio)![0])?.chosen).toBeNull();
		const rows = await db
			.select()
			.from(assessmentResult)
			.where(
				and(eq(assessmentResult.studentId, amina.id), eq(assessmentResult.source, 'daily_check'))
			);
		expect(rows.map((x) => [x.topic, x.score, x.maxScore, x.takenOn]).sort()).toEqual([
			['Fractions', 2, 3, localDate(now)],
			['Ratio', 0, 2, localDate(now)]
		]);
		// one check per day
		await expect(submitDailyCheck(db, amina.id, SECRET, c.token!, answers, now)).rejects.toThrow(
			'st5_err_check_done'
		);
		expect((await dailyCheck(db, amina.id, SECRET, now)).done).toEqual({ score: 2, maxScore: 5 });
		// tomorrow there is a new one
		const tomorrow = await dailyCheck(db, amina.id, SECRET, addDays(now, 1));
		expect(tomorrow.done).toBeNull();
		expect(tomorrow.questions).toHaveLength(5);
	});

	it('quizzes go only to the tutor’s own enrolled students', async () => {
		await expect(assignSet(db, tutorA.id, fractions, other.id, null)).rejects.toThrow(
			'st5_err_not_student'
		);
		await expect(assignSet(db, tutorB.id, fractions, amina.id, null)).rejects.toThrow(
			'st5_err_not_found'
		);
		await expect(assignSet(db, tutorB.id, bSet, amina.id, null)).rejects.toThrow(
			'st5_err_not_student'
		);
		const empty = await createSet(db, tutorA.id, {
			kind: 'quiz',
			title: 'Empty',
			subject: 'Maths',
			topic: 'x',
			dailyChecks: false
		});
		await expect(assignSet(db, tutorA.id, empty.id, amina.id, null)).rejects.toThrow(
			'st5_err_no_questions'
		);
		const { assignment } = await assignSet(db, tutorA.id, fractions, amina.id, '2026-11-20');
		expect(assignment).toMatchObject({ studentId: amina.id, dueOn: '2026-11-20', doneAt: null });
	});

	it('a student can only take their own assignment, once, marked on the server', async () => {
		const testSet = await makeSet(tutorA.id, 'Percentages', false, 2, 'test');
		const { assignment } = await assignSet(db, tutorA.id, testSet, amina.id, null);
		expect(await assignmentToTake(db, tino.id, assignment.id)).toBeNull();
		await expect(
			submitAssignment(db, tino.id, assignment.id, all(qIds.get(testSet)!), now)
		).rejects.toThrow('st5_err_quiz_closed');
		const view = await assignmentToTake(db, amina.id, assignment.id);
		expect(view?.questions).toHaveLength(2);
		expect(JSON.stringify(view?.questions)).not.toContain('"answer"');
		const r = await submitAssignment(db, amina.id, assignment.id, all(qIds.get(testSet)!), now);
		expect(r).toMatchObject({ score: 2, maxScore: 2 });
		await expect(
			submitAssignment(db, amina.id, assignment.id, all(qIds.get(testSet)!), now)
		).rejects.toThrow('st5_err_quiz_closed');
		const [row] = await db
			.select()
			.from(assessmentResult)
			.where(and(eq(assessmentResult.studentId, amina.id), eq(assessmentResult.setId, testSet)));
		expect(row).toMatchObject({
			source: 'test',
			topic: 'Percentages',
			score: 2,
			tutorId: tutorA.id
		});
		const [a] = await db.select().from(quizAssignment).where(eq(quizAssignment.id, assignment.id));
		expect(a.doneAt).not.toBeNull();
		expect((await assignmentToTake(db, amina.id, assignment.id))?.result).toEqual({
			score: 2,
			maxScore: 2
		});
	});

	describe('study time and the family', () => {
		let mum: Awaited<ReturnType<typeof makeUser>>;
		let dad: Awaited<ReturnType<typeof makeUser>>;
		let stranger: Awaited<ReturnType<typeof makeUser>>;
		const sent: { to: string; title: string; body: string; kind?: string }[] = [];
		const notify = async (to: string, title: string, body: string, opts?: { kind?: string }) => {
			sent.push({ to, title, body, kind: opts?.kind });
		};

		beforeAll(async () => {
			mum = await makeUser(db, 'parent', 'Mrs Dube', null);
			dad = await makeUser(db, 'parent', 'Mr Dube', null);
			stranger = await makeUser(db, 'parent', 'Someone', null);
			await db.insert(familyLink).values([
				{ parentId: mum.id, studentId: amina.id, shareStudy: true },
				// Amina chose not to share her study time with this parent
				{ parentId: dad.id, studentId: amina.id, shareStudy: false },
				// waiting for a guardian: sees nothing
				{ parentId: stranger.id, studentId: amina.id, status: 'pending_guardian' }
			]);
		});

		it('tells parents with access once per slot per date, in neutral words', async () => {
			const slot = await addPlanItem(db, amina.id, amina.id, {
				weekday: 1,
				startMinute: 16 * 60,
				minutes: 45,
				subject: 'Maths'
			});
			// too late for this run
			await addPlanItem(db, amina.id, amina.id, {
				weekday: 1,
				startMinute: 17 * 60 + 30,
				minutes: 30,
				subject: 'English'
			});
			// another day
			await addPlanItem(db, amina.id, amina.id, {
				weekday: 2,
				startMinute: 16 * 60,
				minutes: 30,
				subject: 'Science'
			});
			sent.length = 0;
			expect(await sendStudyReminders(db, notify, now)).toBe(1);
			expect(sent).toHaveLength(1);
			expect(sent[0]).toMatchObject({ to: mum.id, title: 'Study time at 4:00 PM', kind: 'study' });
			expect(sent[0].body).toBe(
				"Amina's Maths study time starts at 4:00. Please help Amina keep this time free from chores until 4:45."
			);
			expect(sent[0].body).not.toMatch(/\b(her|his|she|he)\b/i);
			// the next runs don't repeat it
			expect(await sendStudyReminders(db, notify, now)).toBe(0);
			expect(await sendStudyReminders(db, notify, zw(0, '15:40'))).toBe(0);
			const alerts = await db
				.select()
				.from(studyAlertSent)
				.where(eq(studyAlertSent.planItemId, slot!.id));
			expect(alerts).toEqual([expect.objectContaining({ onDate: localDate(now) })]);
			// next Monday it is sent again
			expect(await sendStudyReminders(db, notify, zw(7, '15:10'))).toBe(1);
		});

		it('started and finished sessions are told; stopped ones never', async () => {
			sent.length = 0;
			const s = await startSession(db, amina.id, { subject: 'Maths', minutes: 45 }, zw(0, '16:00'));
			expect(await tellFamilyStudy(db, notify, amina.id, s!, 'started')).toBe(1);
			expect(sent[0]).toMatchObject({ to: mum.id, title: 'Study time started' });
			expect(sent[0].body).toBe('Amina is doing Maths until 4:45.');
			const done = await endSession(db, amina.id, s!.id, true, zw(0, '16:40'));
			expect(await tellFamilyStudy(db, notify, amina.id, done!, 'finished')).toBe(1);
			expect(sent[1].body).toBe('Amina finished 40 minutes of Maths.');
			const s2 = await startSession(
				db,
				amina.id,
				{ subject: 'English', minutes: 30 },
				zw(0, '17:00')
			);
			const stopped = await endSession(db, amina.id, s2!.id, false, zw(0, '17:05'));
			expect(await tellFamilyStudy(db, notify, amina.id, stopped!, 'finished')).toBe(0);
			expect(sent.every((x) => x.to === mum.id)).toBe(true);
		});
	});
});
