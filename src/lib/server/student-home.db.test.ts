import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { freshDb, hasTestDb } from './testing/db.ts';
import { makeUser, MONDAY_8AM } from './testing/fixtures.ts';
import type { DB } from './db/types.ts';
import { homework } from './db/app.schema.ts';
import { learningJourney, mySubjects, subjectOverview } from './student-home.ts';
import { addPlanItem, endSession, startSession } from './study.ts';
import { recordResult } from './progress.ts';
import { addDays } from '../tz.ts';

describe.skipIf(!hasTestDb)('student Home: only real records', () => {
	let db: DB;
	let close: () => Promise<void>;
	let tutorId = '';
	const now = MONDAY_8AM;

	beforeAll(async () => {
		({ db, close } = await freshDb());
		tutorId = (await makeUser(db, 'tutor', 'Tutor')).id;
	});
	afterAll(async () => close?.());

	it('a new student has no learning journey and no subjects (nothing is made up)', async () => {
		const s = await makeUser(db, 'student', 'New Student');
		expect(await learningJourney(db, s.id, now)).toBeNull();
		expect(await mySubjects(db, s.id)).toEqual([]);
		const o = await subjectOverview(db, s.id, 'Mathematics', now);
		expect(o).toMatchObject({
			results: [],
			homework: [],
			nextLesson: null,
			lessonsDone: 0,
			lastStudied: null
		});
	});

	it('continue: the last study session, or the running one', async () => {
		const s = await makeUser(db, 'student', 'Amina');
		const a = await startSession(db, s.id, { subject: 'English', minutes: 20 }, addDays(now, -5));
		await endSession(db, s.id, a!.id, true, addDays(now, -5));
		const b = await startSession(
			db,
			s.id,
			{ subject: 'Mathematics', topic: 'Fractions', minutes: 25 },
			addDays(now, -2)
		);
		await endSession(db, s.id, b!.id, false, addDays(now, -2));
		const j = await learningJourney(db, s.id, now);
		expect(j).toMatchObject({ from: 'session', subject: 'Mathematics', topic: 'Fractions' });
		expect(j!.at.getTime()).toBe(addDays(now, -2).getTime());

		await startSession(db, s.id, { subject: 'Physics', minutes: 25 }, now);
		expect(await learningJourney(db, s.id, now)).toMatchObject({
			from: 'running',
			subject: 'Physics'
		});
	});

	it('subjects come from the plan, sessions, marks and homework, newest first, merged by case', async () => {
		const s = await makeUser(db, 'student', 'Tino');
		await addPlanItem(db, s.id, s.id, {
			weekday: 1,
			startMinute: 900,
			minutes: 30,
			subject: 'Shona'
		});
		await recordResult(db, {
			studentId: s.id,
			source: 'test',
			title: 'Quiz',
			subject: 'mathematics',
			topic: 'Fractions',
			score: 7,
			maxScore: 10,
			takenOn: '2026-11-10'
		});
		const x = await startSession(db, s.id, { subject: 'Mathematics', minutes: 20 }, now);
		await endSession(db, s.id, x!.id, true, now);
		await db.insert(homework).values({ tutorId, userId: s.id, title: 'Essay', subject: 'English' });
		const list = await mySubjects(db, s.id);
		expect(list.map((n) => n.toLowerCase()).sort()).toEqual(['english', 'mathematics', 'shona']);
		expect(list.filter((n) => n.toLowerCase() === 'mathematics')).toHaveLength(1);

		const o = await subjectOverview(db, s.id, 'MATHEMATICS', now);
		expect(o.results).toHaveLength(1);
		expect(o.lastStudied).not.toBeNull();
		const e = await subjectOverview(db, s.id, 'English', now);
		expect(e.homework.map((h) => h.title)).toEqual(['Essay']);
	});
});
