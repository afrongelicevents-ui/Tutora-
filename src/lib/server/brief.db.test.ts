import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { freshDb, hasTestDb } from './testing/db.ts';
import { makeUser, MONDAY_8AM, zw } from './testing/fixtures.ts';
import type { DB } from './db/types.ts';
import { attendee, booking, lesson } from './db/app.schema.ts';
import { assessmentResult, checkin, lessonFeedback } from './db/v3.schema.ts';
import { preLessonBrief, sameSubject } from './brief.ts';
import { recordResult, topicScores } from './progress.ts';
import { addCheckin } from './checkins.ts';
import { saveSchoolSubject } from './school.ts';
import { giveHomework, handIn, markAnswer, setLessonFeedback, studentLessons } from './people.ts';

describe('subject names (no database)', () => {
	it('match loosely, as people type them', () => {
		expect(sameSubject('Maths', 'Mathematics')).toBe(true);
		expect(sameSubject('English', 'english language')).toBe(true);
		expect(sameSubject('Maths', 'Science')).toBe(false);
		expect(sameSubject(null, 'Maths')).toBe(false);
	});
});

describe.skipIf(!hasTestDb)('pre-lesson brief, marking and lesson notes', () => {
	let db: DB;
	let close: () => Promise<void>;
	let T: string;
	let other: string;
	const now = MONDAY_8AM;

	beforeAll(async () => {
		({ db, close } = await freshDb());
		other = (await makeUser(db, 'tutor', 'Other Tutor')).id;
		T = (await makeUser(db, 'tutor', 'Brief Tutor')).id;
	});
	afterAll(async () => close?.());

	it('is empty (not invented) when there is no data', async () => {
		const s = await makeUser(db, 'student', 'Empty Student', T);
		const b = await preLessonBrief(db, T, s.id, { subject: 'Maths', now });
		expect(b).not.toBeNull();
		expect(b!.empty).toBe(true);
		expect(b!.weak).toEqual([]);
		expect(b!.checkin).toBeNull();
		expect(b!.homework).toEqual({ open: 0, overdue: 0, nextDue: null });
		expect(b!.school).toBeNull();
	});

	it('is built from real results, check-ins, homework and school work', async () => {
		const s = await makeUser(db, 'student', 'Amina Brief', T);
		await recordResult(db, {
			studentId: s.id,
			source: 'test',
			title: 'Test 1',
			subject: 'Maths',
			topic: 'Fractions',
			score: 41,
			maxScore: 100,
			takenOn: '2026-11-10'
		});
		await recordResult(db, {
			studentId: s.id,
			source: 'test',
			title: 'Test 2',
			subject: 'Maths',
			topic: 'Algebra',
			score: 90,
			maxScore: 100,
			takenOn: '2026-11-10'
		});
		await addCheckin(db, s.id, { mood: 'finding_hard', shared: false, note: 'private words' });
		await giveHomework(db, T, {
			userId: s.id,
			title: 'Late one',
			note: null,
			dueOn: '2026-11-13',
			fileKey: null,
			fileName: null
		});
		await giveHomework(db, T, {
			userId: s.id,
			title: 'Next one',
			note: null,
			dueOn: '2026-11-20',
			fileKey: null,
			fileName: null
		});
		// homework from another tutor is not this tutor's business
		await giveHomework(db, other, {
			userId: s.id,
			title: 'Other',
			note: null,
			dueOn: '2026-11-01',
			fileKey: null,
			fileName: null
		});
		await saveSchoolSubject(db, s.id, s.id, null, {
			subject: 'Mathematics',
			currentTopic: 'Ratios'
		});

		const b = (await preLessonBrief(db, T, s.id, { subject: 'Maths', now }))!;
		expect(b.empty).toBe(false);
		expect(b.weak).toEqual([{ subject: 'Maths', topic: 'Fractions', pct: 41 }]);
		expect(b.checkin?.mood).toBe('finding_hard');
		expect(JSON.stringify(b)).not.toContain('private words');
		expect(b.homework).toEqual({ open: 2, overdue: 1, nextDue: '2026-11-20' });
		expect(b.school).toEqual({ subject: 'Mathematics', topic: 'Ratios' });
	});

	it('leaves out check-ins the student did not share with tutors', async () => {
		const s = await makeUser(db, 'student', 'Private Student', T);
		const c = await addCheckin(db, s.id, { mood: 'need_help', shared: false });
		await db.update(checkin).set({ sharedWithTutor: false }).where(eq(checkin.id, c.id));
		expect((await preLessonBrief(db, T, s.id, { now }))!.checkin).toBeNull();
	});

	it('only for own students or someone who asked this tutor', async () => {
		const stranger = await makeUser(db, 'student', 'Stranger', null);
		expect(await preLessonBrief(db, T, stranger.id, { now })).toBeNull();
		await db.insert(booking).values({
			tutorId: T,
			userId: stranger.id,
			kind: 'lesson',
			mode: 'online',
			startsAt: zw(1, '16:00'),
			endsAt: zw(1, '17:00')
		});
		expect(await preLessonBrief(db, T, stranger.id, { now })).not.toBeNull();
		expect(await preLessonBrief(db, other, stranger.id, { now })).toBeNull();
	});

	it('a marked answer with a score counts towards progress, once, and only for the owner', async () => {
		const s = await makeUser(db, 'student', 'Marked Student', T);
		const hw = await giveHomework(db, T, {
			userId: s.id,
			title: 'Fractions sheet',
			note: null,
			dueOn: null,
			fileKey: null,
			fileName: null,
			subject: 'Maths',
			topic: 'Fractions'
		});
		const ans = (await handIn(db, s.id, hw.id, { note: 'done', fileKey: null, fileName: null }))!;
		expect(await markAnswer(db, other, ans.id, { comment: 'x', score: 5, maxScore: 10 })).toBe(
			false
		);
		expect(await markAnswer(db, T, ans.id, { comment: 'ok', score: 11, maxScore: 10 })).toBe(false);
		expect(await markAnswer(db, T, ans.id, { comment: 'Good', score: 6, maxScore: 10 }, now)).toBe(
			true
		);
		expect(
			await markAnswer(db, T, ans.id, { comment: 'Better', score: 8, maxScore: 10 }, now)
		).toBe(true);
		const rows = await db
			.select()
			.from(assessmentResult)
			.where(eq(assessmentResult.homeworkAnswerId, ans.id));
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ source: 'homework', score: 8, maxScore: 10, tutorId: T });
		expect((await topicScores(db, s.id))[0]).toMatchObject({ topic: 'Fractions', pct: 80 });

		// without subject and topic the mark is kept on the answer only
		const hw2 = await giveHomework(db, T, {
			userId: s.id,
			title: 'Reading',
			note: null,
			dueOn: null,
			fileKey: null,
			fileName: null
		});
		const a2 = (await handIn(db, s.id, hw2.id, { note: 'read', fileKey: null, fileName: null }))!;
		expect(await markAnswer(db, T, a2.id, { comment: null, score: 3, maxScore: 5 })).toBe(true);
		expect(
			await db.select().from(assessmentResult).where(eq(assessmentResult.homeworkAnswerId, a2.id))
		).toHaveLength(0);
	});

	it('notes for the student after a lesson: own past lessons only', async () => {
		const s = await makeUser(db, 'student', 'Note Student', T);
		const [past] = await db
			.insert(lesson)
			.values({
				tutorId: T,
				mode: 'online',
				startsAt: zw(-2, '16:00'),
				endsAt: zw(-2, '17:00')
			})
			.returning();
		const [future] = await db
			.insert(lesson)
			.values({ tutorId: T, mode: 'online', startsAt: zw(2, '16:00'), endsAt: zw(2, '17:00') })
			.returning();
		const [a1] = await db.insert(attendee).values({ lessonId: past.id, userId: s.id }).returning();
		const [a2] = await db
			.insert(attendee)
			.values({ lessonId: future.id, userId: s.id })
			.returning();
		expect(await setLessonFeedback(db, other, s.id, a1.id, 'Hi', now)).toBe(false);
		expect(await setLessonFeedback(db, T, s.id, a2.id, 'Too early', now)).toBe(false);
		expect(await setLessonFeedback(db, T, 'someone-else', a1.id, 'Wrong', now)).toBe(false);
		expect(await setLessonFeedback(db, T, s.id, a1.id, 'Practise ex. 4', now)).toBe(true);
		expect(await setLessonFeedback(db, T, s.id, a1.id, 'Practise ex. 5', now)).toBe(true);
		const ls = await studentLessons(db, T, s.id);
		expect(ls.find((l) => l.attendeeId === a1.id)?.feedback).toBe('Practise ex. 5');
		expect(await setLessonFeedback(db, T, s.id, a1.id, '  ', now)).toBe(true);
		expect(
			await db
				.select()
				.from(lessonFeedback)
				.where(and(eq(lessonFeedback.attendeeId, a1.id)))
		).toHaveLength(0);
	});
});
