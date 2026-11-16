import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { freshDb, hasTestDb } from './testing/db.ts';
import { makeUser, MONDAY_8AM } from './testing/fixtures.ts';
import type { DB } from './db/types.ts';
import { attendee, lesson } from './db/app.schema.ts';
import { lessonMeeting } from './db/v3.schema.ts';
import {
	checkMeetingLink,
	joinLinks,
	removeStudentLink,
	saveLessonLink,
	saveStudentLink,
	studentLink
} from './meeting-links.ts';

describe('meeting link check (Teams, Google Meet, Zoom; https only)', () => {
	it.each([
		['https://meet.google.com/abc-defg-hij', 'meet'],
		['https://meet.google.com/abc-defg-hij?authuser=0', 'meet'],
		[
			'https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc%40thread.v2/0?context=%7b%7d',
			'teams'
		],
		['https://teams.live.com/meet/9387612345678?p=abc', 'teams'],
		['https://zoom.us/j/1234567890?pwd=xyz', 'zoom'],
		['https://us02web.zoom.us/j/85512345678', 'zoom'],
		['https://zoom.us/my/mrs.moyo', 'zoom'],
		['  https://meet.google.com/abc-defg-hij  ', 'meet']
	])('accepts %s', (url, provider) => {
		const r = checkMeetingLink(url);
		expect(r.ok && r.provider).toBe(provider);
	});

	it.each([
		['', 'ml_err_empty'],
		['http://meet.google.com/abc-defg-hij', 'ml_err_https'],
		['meet.google.com/abc-defg-hij', 'ml_err_kind'],
		['https://meet.google.com/', 'ml_err_kind'],
		['https://meet.google.com/landing', 'ml_err_kind'],
		['https://meet.google.com.evil.example/abc-defg-hij', 'ml_err_kind'],
		['https://evil.example/zoom.us/j/1234567890', 'ml_err_kind'],
		['https://zoom.us.evil.example/j/1234567890', 'ml_err_kind'],
		['https://notzoom.us/j/1234567890', 'ml_err_kind'],
		['https://zoom.us/j/abc', 'ml_err_kind'],
		['https://teams.microsoft.com/', 'ml_err_kind'],
		['https://user:pw@meet.google.com/abc-defg-hij', 'ml_err_kind'],
		['javascript:alert(1)', 'ml_err_https'],
		['https://www.youtube.com/watch?v=x', 'ml_err_kind']
	])('refuses %s with a clear error', (url, error) => {
		const r = checkMeetingLink(url);
		expect(r.ok).toBe(false);
		expect(!r.ok && r.error).toBe(error);
	});
});

describe.skipIf(!hasTestDb)('meeting links (real database)', () => {
	let db: DB;
	let close: () => Promise<void>;
	beforeAll(async () => ({ db, close } = await freshDb()));
	afterAll(async () => close?.());

	const at = (h: number) => new Date(MONDAY_8AM.getTime() + h * 3_600_000);
	async function lessonFor(tutorId: string, students: string[], capacity = 1, h = 0) {
		const [l] = await db
			.insert(lesson)
			.values({ tutorId, mode: 'online', startsAt: at(h), endsAt: at(h + 1), capacity })
			.returning();
		for (const s of students) await db.insert(attendee).values({ lessonId: l.id, userId: s });
		return l.id;
	}

	it('one link per student, replaced on save; refused when not a real link', async () => {
		const t = await makeUser(db, 'tutor', 'Mrs Link');
		const s = await makeUser(db, 'student', 'Link Student', t.id);
		const bad = await saveStudentLink(db, t.id, s.id, 'https://example.com/meeting');
		expect(bad).toEqual({ ok: false, error: 'ml_err_kind' });
		expect(await studentLink(db, t.id, s.id)).toBeNull();
		await saveStudentLink(db, t.id, s.id, 'https://meet.google.com/aaa-bbbb-ccc');
		await saveStudentLink(db, t.id, s.id, 'https://zoom.us/j/1234567890');
		expect(await studentLink(db, t.id, s.id)).toEqual({
			provider: 'zoom',
			url: 'https://zoom.us/j/1234567890'
		});
		await removeStudentLink(db, t.id, s.id);
		expect(await studentLink(db, t.id, s.id)).toBeNull();
	});

	it('warns when the same link is saved for students who are not in the same class', async () => {
		const t = await makeUser(db, 'tutor', 'Mrs Same');
		const a = await makeUser(db, 'student', 'Anesu', t.id);
		const b = await makeUser(db, 'student', 'Busi', t.id);
		const c = await makeUser(db, 'student', 'Chido', t.id);
		const url = 'https://meet.google.com/xyz-abcd-efg';
		expect(await saveStudentLink(db, t.id, a.id, url)).toMatchObject({ ok: true, sharedWith: [] });
		// Busi has no class with Anesu: warned
		expect(await saveStudentLink(db, t.id, b.id, url)).toMatchObject({
			ok: true,
			sharedWith: ['Anesu']
		});
		// Chido is in a group lesson with Anesu (not with Busi): only Busi is named
		await lessonFor(t.id, [a.id, c.id], 4);
		expect(await saveStudentLink(db, t.id, c.id, url)).toMatchObject({
			ok: true,
			sharedWith: ['Busi']
		});
		// another tutor's students never count
		const t2 = await makeUser(db, 'tutor', 'Mr Else');
		const d = await makeUser(db, 'student', 'Dudu', t2.id);
		expect(await saveStudentLink(db, t2.id, d.id, url)).toMatchObject({ sharedWith: [] });
	});

	it('join link: the lesson meeting, else the class link, else the student link, else the room', async () => {
		const t = await makeUser(db, 'tutor', 'Mrs Order');
		const s = await makeUser(db, 'student', 'Order Student', t.id);
		const s2 = await makeUser(db, 'student', 'Order Two', t.id);
		const one = await lessonFor(t.id, [s.id], 1, 2);
		const made = await lessonFor(t.id, [s.id], 1, 4);
		const group = await lessonFor(t.id, [s.id, s2.id], 4, 6);
		const bare = await lessonFor(t.id, [s2.id], 1, 8);
		await saveStudentLink(db, t.id, s.id, 'https://zoom.us/j/1112223334');
		await db.insert(lessonMeeting).values({
			lessonId: made,
			provider: 'teams',
			joinUrl: 'https://teams.microsoft.com/l/meetup-join/abc'
		});
		expect(
			await saveLessonLink(db, t.id, group, 'https://meet.google.com/grp-abcd-efg')
		).toMatchObject({ ok: true });
		// another tutor cannot set a link on this lesson
		const other = await makeUser(db, 'tutor', 'Mr Nope');
		expect(await saveLessonLink(db, other.id, group, 'https://zoom.us/j/1234567890')).toEqual({
			ok: false,
			error: 'err_not_found'
		});
		const q = (id: number, ids: string[], g = false) => ({
			lessonId: id,
			tutorId: t.id,
			studentIds: ids,
			group: g
		});
		const j = await joinLinks(db, [
			q(one, [s.id]),
			q(made, [s.id]),
			q(group, [s.id, s2.id], true),
			q(bare, [s2.id])
		]);
		expect(j.get(one)).toMatchObject({ provider: 'zoom', from: 'student' });
		expect(j.get(made)).toMatchObject({ provider: 'teams', from: 'lesson' });
		expect(j.get(group)).toMatchObject({ provider: 'meet', from: 'class' });
		expect(j.has(bare)).toBe(false);
		// a group lesson without a class link never uses one student's own link
		const g2 = await lessonFor(t.id, [s.id, s2.id], 4, 10);
		expect((await joinLinks(db, [q(g2, [s.id], true)])).has(g2)).toBe(false);
		expect((await joinLinks(db, [])).size).toBe(0);
	});
});
