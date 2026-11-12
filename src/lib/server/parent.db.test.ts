import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshDb, hasTestDb, testAuth } from './testing/db.ts';
import { makeUser, MONDAY_8AM } from './testing/fixtures.ts';
import type { DB } from './db/types.ts';
import { notification, profile } from './db/app.schema.ts';
import { user } from './db/auth.schema.ts';
import { createInvite, redeemInvite, setSharing } from './family.ts';
import { createChildAccount, setChildLogin } from './family-accounts.ts';
import { addCheckin } from './checkins.ts';
import { recordResult } from './progress.ts';
import { addPlanItem, endSession, startSession } from './study.ts';
import { chooseTip, childOverview, childUpdates, weeklyReport } from './parent.ts';
import {
	byToken,
	logOf,
	postMessage,
	requestPartnership,
	schoolRespond,
	stopPartnership,
	tutorDecide
} from './partnership.ts';
import { sendWeeklyReports } from './weekly.ts';
import { addDays, fromLocal, startOfLocalWeek } from '../tz.ts';

const ALL = {
	ok: true,
	guardian: false,
	progress: true,
	lessons: true,
	homework: true,
	study: true
};

describe('how you can help (no database)', () => {
	const base = {
		access: ALL,
		weak: null,
		weakPlanned: false,
		checkin: null,
		week: null,
		streak: 0,
		homeworkDue: null,
		exam: null
	};
	it('is encouraging and uses only what is shared', () => {
		expect(chooseTip(base).kind).toBe('interest');
		expect(chooseTip({ ...base, checkin: { mood: 'need_break' } }).kind).toBe('break');
		expect(chooseTip({ ...base, weak: { topic: 'Fractions' }, weakPlanned: true })).toEqual({
			kind: 'weak_planned',
			topic: 'Fractions'
		});
		// progress not shared: no topic advice
		expect(
			chooseTip({ ...base, access: { ...ALL, progress: false }, weak: { topic: 'Fractions' } }).kind
		).toBe('interest');
		expect(chooseTip({ ...base, week: { planned: 3, done: 3 } }).kind).toBe('all_done');
	});
});

describe.skipIf(!hasTestDb)('parent area: visibility, younger children, School+', () => {
	let db: DB;
	let close: () => Promise<void>;
	let T: string;
	const now = MONDAY_8AM;

	beforeAll(async () => {
		({ db, close } = await freshDb());
		T = (await makeUser(db, 'tutor', 'Miss Doreen')).id;
	});
	afterAll(async () => close?.());

	async function link(student: string, parent: string, guardian = false) {
		const { code } = await createInvite(db, student, now);
		await redeemInvite(db, code, parent, { guardianClaim: guardian }, now);
	}

	it('a parent sees nothing of a child who is not connected, and only what is shared', async () => {
		const amina = await makeUser(db, 'student', 'Amina Dube');
		const mum = await makeUser(db, 'parent', 'Mrs Dube', null);
		const stranger = await makeUser(db, 'parent', 'Stranger', null);
		await addPlanItem(db, amina.id, amina.id, {
			weekday: 1,
			startMinute: 7 * 60 + 50,
			minutes: 45,
			subject: 'Maths',
			topic: 'Fractions'
		});
		await recordResult(db, {
			studentId: amina.id,
			source: 'test',
			title: 't',
			subject: 'Maths',
			topic: 'Fractions',
			score: 4,
			maxScore: 10,
			takenOn: '2026-11-14'
		});
		await addCheckin(db, amina.id, { mood: 'confident', shared: false, note: 'private words' });
		expect(await childOverview(db, stranger.id, amina.id, now)).toBeNull();
		expect(await childUpdates(db, stranger.id, amina.id, now)).toBeNull();
		await link(amina.id, mum.id);
		const o = (await childOverview(db, mum.id, amina.id, now))!;
		expect(o.alert?.kind).toBe('study_now');
		expect(o.overall).toBe(40);
		expect(o.checkin).toBeNull(); // not shared
		expect(o.tip).toEqual({ kind: 'weak_planned', topic: 'Fractions' });
		// Amina hides progress and study: the numbers disappear
		await setSharing(db, amina.id, mum.id, {
			progress: false,
			lessons: true,
			homework: true,
			study: false
		});
		const hidden = (await childOverview(db, mum.id, amina.id, now))!;
		expect(hidden.overall).toBeNull();
		expect(hidden.week).toBeNull();
		expect(hidden.alert).toBeNull();
		expect(hidden.tip.kind).toBe('interest');
		const updates = (await childUpdates(db, mum.id, amina.id, now))!;
		expect(updates.some((u) => u.kind === 'result')).toBe(false);
		expect(JSON.stringify(updates)).not.toContain('private words');
	});

	it('updates and the weekly report come from real sessions', async () => {
		const tino = await makeUser(db, 'student', 'Tino Dube');
		const mum = await makeUser(db, 'parent', 'Mum Two', null);
		await link(tino.id, mum.id);
		const s = await startSession(
			db,
			tino.id,
			{ subject: 'Reading', minutes: 20 },
			addDays(now, -1)
		);
		await endSession(db, tino.id, s!.id, true, new Date(addDays(now, -1).getTime() + 20 * 60_000));
		const u = (await childUpdates(db, mum.id, tino.id, now))!;
		expect(u[0]).toMatchObject({ kind: 'study_done', text: { subject: 'Reading', minutes: 20 } });
		const r = (await weeklyReport(db, mum.id, tino.id, addDays(startOfLocalWeek(now), -7)))!;
		expect(r.sessionsDone).toBe(1);
		expect(r.minutes).toBe(20);
		// the weekly message goes out once, Sunday from 5 PM
		const sunday = fromLocal('2026-11-22', 17 * 60 + 5);
		const sent: string[] = [];
		const notify = async (id: string) => {
			sent.push(id);
		};
		expect(await sendWeeklyReports(db, notify, fromLocal('2026-11-22', 9 * 60))).toBe(0);
		await sendWeeklyReports(db, notify, sunday);
		const again = await sendWeeklyReports(db, notify, sunday);
		expect(sent.filter((x) => x === mum.id)).toHaveLength(1);
		expect(again).toBe(0);
	});

	it('a parent creates a younger child account who logs in with a username', async () => {
		const mum = await makeUser(db, 'parent', 'Mrs Moyo', null);
		await db.update(profile).set({ phone: '+263771234567' }).where(eq(profile.userId, mum.id));
		const { auth } = testAuth(db);
		const bad = await createChildAccount({ auth, db }, mum.id, {
			name: 'Tari',
			username: 'X',
			password: 'short'
		});
		expect(bad.ok).toBe(false);
		const r = await createChildAccount({ auth, db }, mum.id, {
			name: 'Tari Moyo',
			username: 'tari.moyo',
			password: 'a-long-password',
			year: 'Grade 5'
		});
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		const [kid] = await db.select().from(user).where(eq(user.id, r.studentId));
		expect(kid.email).toBe('tari.moyo@kids.tutora.invalid');
		expect(kid.role).toBe('student');
		const o = await childOverview(db, mum.id, r.studentId, now);
		expect(o?.access.guardian).toBe(true);
		const login = await auth.api.signInEmail({
			body: { email: 'tari.moyo@kids.tutora.invalid', password: 'a-long-password' }
		});
		expect(login.user.id).toBe(r.studentId);
		// the same username can't be taken twice; another parent can't change the login
		const dup = await createChildAccount({ auth, db }, mum.id, {
			name: 'Other',
			username: 'tari.moyo',
			password: 'a-long-password'
		});
		expect(dup.ok).toBe(false);
		const other = await makeUser(db, 'parent', 'Other parent', null);
		await expect(
			setChildLogin({ auth, db }, other.id, r.studentId, {
				username: 'hack',
				password: 'a-long-password'
			})
		).rejects.toThrow();
	});

	it('School+: consent, tutor, school opt-in, logged messages, parent stops it', async () => {
		const kid = await makeUser(db, 'student', 'Rudo');
		await db
			.update(profile)
			.set({ isUnder18: true, parentName: 'P', parentPhone: '+263770000000' })
			.where(eq(profile.userId, kid.id));
		const guardian = await makeUser(db, 'parent', 'Guardian', null);
		const aunt = await makeUser(db, 'parent', 'Aunt', null);
		await link(kid.id, guardian.id, true);
		const base = {
			studentId: kid.id,
			tutorId: T,
			subject: 'Maths',
			schoolName: 'Test High',
			teacherName: 'Mr Teacher',
			consentName: 'Guardian Person',
			consent: true
		};
		// only the guardian can consent for a child under 18; consent must be given
		await link(kid.id, aunt.id); // pending approval: no access at all
		await expect(requestPartnership(db, aunt.id, base)).rejects.toThrow();
		await expect(requestPartnership(db, guardian.id, { ...base, consent: false })).rejects.toThrow(
			'sp3_err_consent'
		);
		const other = await makeUser(db, 'tutor', 'Not their tutor', null);
		await expect(
			requestPartnership(db, guardian.id, { ...base, tutorId: other.id })
		).rejects.toThrow('sp3_err_tutor');
		const p = await requestPartnership(db, guardian.id, base);
		expect(p.consentText).toContain('Test High');
		// another tutor can't act on it
		await expect(tutorDecide(db, other.id, p.id, true)).rejects.toThrow();
		const { token } = await tutorDecide(db, T, p.id, true);
		expect(token).toMatch(/^[0-9a-f]{48}$/);
		// no messages before the school agrees
		await expect(postMessage(db, { role: 'teacher', token: token! }, 'hello')).rejects.toThrow();
		await schoolRespond(db, token!, true, 'Mr Teacher');
		await postMessage(db, { role: 'teacher', token: token! }, 'We start fractions next week.');
		await postMessage(db, { role: 'tutor', tutorId: T, id: p.id }, 'Thanks, I will match it.');
		const log = await logOf(db, p.id);
		expect(log.filter((l) => l.kind === 'message').map((l) => l.fromRole)).toEqual([
			'teacher',
			'tutor'
		]);
		// the parent stops it: the school's link stops working at once
		await expect(stopPartnership(db, aunt.id, p.id)).rejects.toThrow();
		await stopPartnership(db, guardian.id, p.id);
		expect(await byToken(db, token!)).toBeNull();
		await expect(
			postMessage(db, { role: 'tutor', tutorId: T, id: p.id }, 'more')
		).rejects.toThrow();
		expect((await logOf(db, p.id)).at(-1)?.body).toContain('stopped');
	});

	it('shared check-ins reach parents without the note', async () => {
		const n = await db.select().from(notification);
		expect(JSON.stringify(n)).not.toContain('private words');
	});
});
