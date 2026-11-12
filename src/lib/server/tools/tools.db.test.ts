import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshDb, hasTestDb } from '../testing/db.ts';
import { makeUser, zw } from '../testing/fixtures.ts';
import type { DB } from '../db/types.ts';
import { attendee, homework, homeworkAnswer, lesson, subject } from '../db/app.schema.ts';
import { user } from '../db/auth.schema.ts';
import { assessmentResult, connectedAccount, lessonMeeting } from '../db/v3.schema.ts';
import {
	cancelMeetingForLesson,
	createMeetingForLesson,
	getToolPref,
	harareDateTime,
	setToolPref,
	type ToolsEnv
} from './meetings.ts';
import {
	accessToken,
	connections,
	disconnect,
	G_CALENDAR,
	G_DRIVE_FILE,
	saveAccount
} from './oauth.ts';
import { shareFile, verifyPickedFile } from './drive.ts';
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

interface Call {
	url: string;
	method: string;
	body: string;
	auth: string | null;
}

/** A pretend Google / Microsoft: answers by URL, records every call. */
function mockFetch(routes: [RegExp, (c: Call) => Response][]) {
	const calls: Call[] = [];
	const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		const h = new Headers(init?.headers);
		const c: Call = {
			url,
			method: init?.method ?? 'GET',
			body: init?.body ? String(init.body) : '',
			auth: h.get('authorization')
		};
		calls.push(c);
		for (const [re, fn] of routes) if (re.test(url)) return fn(c);
		return new Response('{}', { status: 404 });
	}) as typeof fetch;
	return { f, calls };
}
const json = (v: unknown, status = 200) =>
	new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json' } });

const baseEnv: ToolsEnv = {
	origin: 'https://tutora.example',
	secret: 'auth-secret-auth-secret-auth-secret-123',
	GOOGLE_CLIENT_ID: 'gid',
	GOOGLE_CLIENT_SECRET: 'gsecret',
	GOOGLE_API_KEY: 'key',
	GOOGLE_APP_ID: '123',
	MS_CLIENT_ID: 'msid',
	MS_CLIENT_SECRET: 'mssecret'
};

describe.skipIf(!hasTestDb)('Connected Tools (real database, pretend Google/Microsoft)', () => {
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

	async function connect(provider: 'google' | 'microsoft', scope: string, userId = tid) {
		await saveAccount(
			db,
			baseEnv,
			userId,
			provider,
			{ access_token: `at-${provider}`, refresh_token: `rt-${provider}`, expires_in: 3600, scope },
			[]
		);
	}

	describe('tokens', () => {
		beforeEach(async () => {
			await db.delete(connectedAccount);
		});
		it('stores tokens encrypted and shows only labels', async () => {
			await connect('google', `openid email ${G_CALENDAR} ${G_DRIVE_FILE}`);
			const [row] = await db.select().from(connectedAccount);
			expect(row.accessTokenEnc).not.toContain('at-google');
			expect(row.refreshTokenEnc).not.toContain('rt-google');
			const c = await connections(db, tid);
			expect(c).toMatchObject({ meet: true, drive: true, teams: false });
			expect(JSON.stringify(c)).not.toContain('at-google');
			expect(await accessToken(db, baseEnv, tid, 'google', G_CALENDAR)).toBe('at-google');
		});
		it('refreshes an expired token, and forgets a revoked grant', async () => {
			await connect('google', `openid ${G_DRIVE_FILE}`);
			await db.update(connectedAccount).set({ expiresAt: new Date(Date.now() - 1000) });
			const { f, calls } = mockFetch([
				[/oauth2\.googleapis\.com\/token/, () => json({ access_token: 'new-at', expires_in: 3600 })]
			]);
			expect(await accessToken(db, { ...baseEnv, fetch: f }, tid, 'google')).toBe('new-at');
			expect(calls[0].body).toContain('grant_type=refresh_token');
			expect(await accessToken(db, baseEnv, tid, 'google')).toBe('new-at');
			// scope not granted
			expect(await accessToken(db, baseEnv, tid, 'google', G_CALENDAR)).toBeNull();

			await db.update(connectedAccount).set({ expiresAt: new Date(Date.now() - 1000) });
			const bad = mockFetch([[/token/, () => json({ error: 'invalid_grant' }, 400)]]);
			expect(await accessToken(db, { ...baseEnv, fetch: bad.f }, tid, 'google')).toBeNull();
			expect(await connections(db, tid)).toMatchObject({ google: null });
		});
		it('is off when the OAuth app is not configured', async () => {
			await connect('google', G_DRIVE_FILE);
			expect(
				await accessToken(db, { ...baseEnv, GOOGLE_CLIENT_ID: undefined }, tid, 'google')
			).toBeNull();
		});
		it('disconnect revokes at Google and deletes the row', async () => {
			await connect('google', G_DRIVE_FILE);
			const { f, calls } = mockFetch([[/revoke/, () => new Response('', { status: 200 })]]);
			expect(await disconnect(db, { ...baseEnv, fetch: f }, tid, 'google')).toEqual({
				revoked: true
			});
			expect(calls[0].body).toBe('token=rt-google');
			expect(await db.select().from(connectedAccount)).toHaveLength(0);
		});
		it('disconnect for Microsoft just deletes (no revoke endpoint)', async () => {
			await connect('microsoft', 'OnlineMeetings.ReadWrite');
			const { f, calls } = mockFetch([]);
			expect(await disconnect(db, { ...baseEnv, fetch: f }, tid, 'microsoft')).toEqual({
				revoked: false
			});
			expect(calls).toHaveLength(0);
			expect(await db.select().from(connectedAccount)).toHaveLength(0);
		});
	});

	describe('meetings', () => {
		beforeEach(async () => {
			await db.delete(connectedAccount);
			await db.delete(lessonMeeting);
		});
		it('formats Zimbabwe time', () => {
			expect(harareDateTime(zw(1, '16:00'))).toBe('2026-11-17T16:00:00+02:00');
		});
		it('uses the low-data room by default and for in-person lessons', async () => {
			const { f, calls } = mockFetch([]);
			expect(
				await createMeetingForLesson(db, { ...baseEnv, fetch: f }, await newLesson())
			).toBeNull();
			await setToolPref(db, tid, { meetingTool: 'meet' });
			await connect('google', G_CALENDAR);
			expect(
				await createMeetingForLesson(db, { ...baseEnv, fetch: f }, await newLesson('in_person'))
			).toBeNull();
			expect(calls).toHaveLength(0);
		});
		it('creates a Google Meet with no attendees and stores the link', async () => {
			await setToolPref(db, tid, { meetingTool: 'meet' });
			await connect('google', `openid ${G_CALENDAR}`);
			const { f, calls } = mockFetch([
				[
					/calendar\/v3/,
					() => json({ id: 'ev1', hangoutLink: 'https://meet.google.com/abc-defg-hij' })
				]
			]);
			const id = await newLesson();
			const m = await createMeetingForLesson(db, { ...baseEnv, fetch: f }, id);
			expect(m).toEqual({ provider: 'meet', joinUrl: 'https://meet.google.com/abc-defg-hij' });
			expect(calls[0].url).toContain('conferenceDataVersion=1');
			expect(calls[0].auth).toBe('Bearer at-google');
			const body = JSON.parse(calls[0].body);
			expect(body.attendees).toBeUndefined();
			expect(calls[0].body).not.toContain('@');
			expect(body.summary).toBe('Tutora lesson: Maths');
			expect(body.start).toEqual({
				dateTime: '2026-11-17T16:00:00+02:00',
				timeZone: 'Africa/Harare'
			});
			expect(body.conferenceData.createRequest.conferenceSolutionKey.type).toBe('hangoutsMeet');
			// a second call reuses it
			expect(await createMeetingForLesson(db, { ...baseEnv, fetch: f }, id)).toEqual(m);
			expect(calls).toHaveLength(1);

			// cancelling deletes the event
			const del = mockFetch([[/calendar\/v3/, () => new Response(null, { status: 204 })]]);
			expect(await cancelMeetingForLesson(db, { ...baseEnv, fetch: del.f }, id)).toBe(true);
			expect(del.calls[0]).toMatchObject({ method: 'DELETE' });
			expect(del.calls[0].url).toContain('/events/ev1');
			expect(await db.select().from(lessonMeeting)).toHaveLength(0);
		});
		it('creates a Teams meeting; a personal account (error) falls back to the room', async () => {
			await setToolPref(db, tid, { meetingTool: 'teams' });
			await connect('microsoft', 'openid OnlineMeetings.ReadWrite User.Read');
			const ok = mockFetch([
				[
					/onlineMeetings/,
					() => json({ id: 'mt1', joinWebUrl: 'https://teams.microsoft.com/l/meetup-join/x' }, 201)
				]
			]);
			expect(
				await createMeetingForLesson(db, { ...baseEnv, fetch: ok.f }, await newLesson())
			).toEqual({
				provider: 'teams',
				joinUrl: 'https://teams.microsoft.com/l/meetup-join/x'
			});
			const body = JSON.parse(ok.calls[0].body);
			expect(body.subject).toBe('Tutora lesson: Maths');
			expect(body.startDateTime).toBe(zw(1, '16:00').toISOString());
			const fail = mockFetch([
				[/onlineMeetings/, () => json({ error: { code: 'Forbidden' } }, 403)]
			]);
			expect(
				await createMeetingForLesson(db, { ...baseEnv, fetch: fail.f }, await newLesson())
			).toBeNull();
			const thrown = (async () => {
				throw new Error('network down');
			}) as unknown as typeof fetch;
			expect(
				await createMeetingForLesson(db, { ...baseEnv, fetch: thrown }, await newLesson())
			).toBeNull();
		});
		it('Meet chosen but not connected: room', async () => {
			await setToolPref(db, tid, { meetingTool: 'meet' });
			expect(await createMeetingForLesson(db, baseEnv, await newLesson())).toBeNull();
			expect((await getToolPref(db, tid)).meetingTool).toBe('meet');
		});
	});

	describe('drive', () => {
		beforeEach(async () => {
			await db.delete(connectedAccount);
		});
		it('verifies a picked file with the server token and shares it', async () => {
			await connect('google', G_DRIVE_FILE);
			const { f, calls } = mockFetch([
				[/permissions/, () => json({ id: 'p1' })],
				[
					/drive\/v3\/files\/file_abcdefghij/,
					() =>
						json({
							id: 'file_abcdefghij',
							name: 'Notes.pdf',
							webViewLink: 'https://drive.google.com/file/d/file_abcdefghij/view'
						})
				]
			]);
			const env = { ...baseEnv, fetch: f };
			const file = await verifyPickedFile(db, env, tid, 'file_abcdefghij');
			expect(file).toMatchObject({ name: 'Notes.pdf' });
			expect(await verifyPickedFile(db, env, tid, '../../x')).toBeNull();
			expect(await shareFile(db, env, tid, 'file_abcdefghij', 'kid@example.com')).toBe('shared');
			expect(JSON.parse(calls.at(-1)!.body)).toEqual({
				type: 'user',
				role: 'reader',
				emailAddress: 'kid@example.com'
			});
			expect(await shareFile(db, env, tid, 'file_abcdefghij', 'tino@kids.tutora.invalid')).toBe(
				'skipped'
			);
			expect(await verifyPickedFile(db, baseEnv, sid, 'file_abcdefghij')).toBeNull();
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
