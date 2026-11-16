import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshDb, hasTestDb } from '../testing/db.ts';
import { makeUser, zw } from '../testing/fixtures.ts';
import type { DB } from '../db/types.ts';
import { attendee, homework, homeworkAnswer, lesson, subject } from '../db/app.schema.ts';
import { user } from '../db/auth.schema.ts';
import { assessmentResult, lessonMeeting } from '../db/v3.schema.ts';
import { getToolPref, meetingFor, setToolPref } from './meetings.ts';
import {
	addAnswerLink,
	addHomeworkLink,
	addLessonMaterial,
	addResource,
	answerLinks,
	checkUrl,
	homeworkLinks,
	lessonMaterialsForStudent,
	lessonMaterialsForTutor,
	MaterialFail,
	removeHomeworkLink,
	removeLessonMaterial,
	removeResource,
	resourcesForStudent
} from '../materials.ts';
import { recordKahootScores } from './kahoot-import.ts';
import { SHORTCUT_TOOLS, shortcutUrl } from '../../tool-shortcuts.ts';

describe('Connected Tools are shortcuts only', () => {
	it('every shortcut opens the real app over https, with no account or key in the link', () => {
		for (const tool of SHORTCUT_TOOLS)
			for (const role of ['student', 'tutor'] as const) {
				const u = new URL(shortcutUrl(tool, role));
				expect(u.protocol).toBe('https:');
				expect(u.search).toBe('');
				expect(u.username + u.password).toBe('');
			}
		expect(shortcutUrl('kahoot', 'student')).toBe('https://kahoot.it/');
		expect(shortcutUrl('teams', 'tutor')).toBe('https://teams.microsoft.com/');
	});
});

describe.skipIf(!hasTestDb)('Connected Tools (real database)', () => {
	let db: DB;
	let close: () => Promise<void>;
	let tid: string;
	let sid: string;
	let other: string;
	let subjId: number;
	beforeAll(async () => {
		({ db, close } = await freshDb());
		other = (await makeUser(db, 'tutor', 'Other Tutor')).id;
		tid = (await makeUser(db, 'tutor', 'Tutor One')).id;
		sid = (await makeUser(db, 'student', 'Tinotenda Dube')).id;
		const [s] = await db.insert(subject).values({ tutorId: tid, name: 'Maths' }).returning();
		subjId = s.id;
	});

	afterAll(async () => close?.());

	async function newLesson(mode: 'online' | 'in_person' = 'online', tutorId = tid) {
		const [l] = await db
			.insert(lesson)
			.values({
				tutorId,
				subjectId: subjId,
				kind: 'lesson',
				mode,
				startsAt: zw(1, '16:00'),
				endsAt: zw(1, '17:00'),
				capacity: 1
			})
			.returning();
		await db.insert(attendee).values({ lessonId: l.id, userId: sid, priceCents: 0 });
		return l.id;
	}

	describe('tool choices', () => {
		it('Kahoot! is off until switched on; nothing else is stored', async () => {
			expect((await getToolPref(db, tid)).kahootOn).toBe(false);
			await setToolPref(db, tid, { kahootOn: true });
			expect((await getToolPref(db, tid)).kahootOn).toBe(true);
			await setToolPref(db, tid, { kahootOn: false });
			expect((await getToolPref(db, tid)).kahootOn).toBe(false);
		});
		it('an old lesson keeps the meeting link stored before links were pasted', async () => {
			const id = await newLesson();
			expect(await meetingFor(db, id)).toBeNull();
			await db.insert(lessonMeeting).values({
				lessonId: id,
				provider: 'meet',
				joinUrl: 'https://meet.google.com/abc-defg-hij'
			});
			expect(await meetingFor(db, id)).toEqual({
				provider: 'meet',
				joinUrl: 'https://meet.google.com/abc-defg-hij'
			});
		});
	});

	describe('materials', () => {
		it('checks links', () => {
			expect(checkUrl('kahoot', 'https://create.kahoot.it/details/abc')).toContain(
				'create.kahoot.it'
			);
			expect(checkUrl('kahoot', 'https://kahoot.it/challenge/123')).toContain('kahoot.it');
			expect(() => checkUrl('kahoot', 'https://kahoot.it.evil.com/x')).toThrow(MaterialFail);
			expect(() => checkUrl('link', 'http://example.com')).toThrow('tools6_err_https');
			expect(() => checkUrl('link', 'javascript:alert(1)')).toThrow(MaterialFail);
			expect(() => checkUrl('drive', 'https://example.com/file')).toThrow(MaterialFail);
		});
		it('lesson materials: only the tutor of the lesson, seen by booked students', async () => {
			const id = await newLesson();
			await expect(
				addLessonMaterial(db, other, id, { kind: 'link', title: 'x', url: 'https://example.com' })
			).rejects.toThrow('err_not_found');
			const m = await addLessonMaterial(db, tid, id, {
				kind: 'kahoot',
				title: 'Warm-up quiz',
				url: 'https://create.kahoot.it/details/x'
			});
			expect(await lessonMaterialsForTutor(db, tid, id)).toHaveLength(1);
			expect(await lessonMaterialsForTutor(db, other, id)).toHaveLength(0);
			expect(await lessonMaterialsForStudent(db, sid, id)).toHaveLength(1);
			expect(await lessonMaterialsForStudent(db, other, id)).toHaveLength(0);
			expect(await removeLessonMaterial(db, other, id, m.id)).toBe(false);
			expect(await removeLessonMaterial(db, tid, id, m.id)).toBe(true);
		});
		it('resources for one student or all, only for enrolled students', async () => {
			const stranger = (await makeUser(db, 'student', 'Stranger', other)).id;
			await expect(
				addResource(db, tid, {
					subject: 'Maths',
					studentId: stranger,
					kind: 'link',
					title: 'x',
					url: 'https://example.com'
				})
			).rejects.toThrow('err_not_found');
			const all = await addResource(db, tid, {
				subject: 'Maths',
				kind: 'link',
				title: 'Past paper',
				url: 'https://example.com/p'
			});
			await addResource(db, tid, {
				subject: 'Maths',
				studentId: sid,
				kind: 'link',
				title: 'For Tino',
				url: 'https://example.com/t'
			});
			expect((await resourcesForStudent(db, sid)).map((r) => r.title).sort()).toEqual([
				'For Tino',
				'Past paper'
			]);
			expect(await resourcesForStudent(db, stranger)).toHaveLength(0);
			expect(await removeResource(db, other, all.id)).toBe(false);
			expect(await removeResource(db, tid, all.id)).toBe(true);
		});
		it('homework and answer links', async () => {
			const [hw] = await db
				.insert(homework)
				.values({ tutorId: tid, userId: sid, title: 'Fractions' })
				.returning();
			const [ans] = await db
				.insert(homeworkAnswer)
				.values({ homeworkId: hw.id, note: 'done' })
				.returning();
			await expect(
				addHomeworkLink(db, other, hw.id, { kind: 'link', title: 'x', url: 'https://example.com' })
			).rejects.toThrow('err_not_found');
			const h = await addHomeworkLink(db, tid, hw.id, {
				kind: 'drive',
				title: 'Worksheet',
				url: 'https://docs.google.com/document/d/abc',
				driveFileId: 'abcdefghijkl'
			});
			const [stu] = await db.select({ email: user.email }).from(user).where(eq(user.id, sid));
			expect(h.studentEmail).toBe(stu.email);
			await expect(
				addAnswerLink(db, other, ans.id, { kind: 'link', title: 'x', url: 'https://example.com' })
			).rejects.toThrow('err_not_found');
			const a = await addAnswerLink(db, sid, ans.id, {
				kind: 'link',
				title: 'My work',
				url: 'https://example.com/w'
			});
			expect(await homeworkLinks(db, sid, hw.id)).toHaveLength(1);
			expect(await homeworkLinks(db, other, hw.id)).toHaveLength(0);
			expect(await answerLinks(db, tid, ans.id)).toHaveLength(1);
			expect(await removeHomeworkLink(db, tid, a.link.id)).toBe(false);
			expect(await removeHomeworkLink(db, sid, a.link.id)).toBe(true);
			expect(await removeHomeworkLink(db, sid, h.link.id)).toBe(false);
			expect(await removeHomeworkLink(db, tid, h.link.id)).toBe(true);
		});
	});

	describe('Kahoot! scores', () => {
		it('records only for the tutor’s own students', async () => {
			const stranger = (await makeUser(db, 'student', 'Stranger 2', other)).id;
			const r = await recordKahootScores(db, tid, {
				subject: 'Maths',
				topic: 'Fractions',
				title: 'Kahoot: fractions',
				takenOn: '2026-11-12',
				rows: [
					{ studentId: sid, correct: 7, incorrect: 3 },
					{ studentId: stranger, correct: 10, incorrect: 0 },
					{ studentId: sid, correct: 0, incorrect: 0 }
				]
			});
			expect(r).toEqual({ saved: 1, skipped: 2 });
			const rows = await db
				.select()
				.from(assessmentResult)
				.where(eq(assessmentResult.source, 'kahoot'));
			expect(rows).toHaveLength(1);
			expect(rows[0]).toMatchObject({ studentId: sid, score: 7, maxScore: 10, tutorId: tid });
		});
	});
});
