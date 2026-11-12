import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshDb, hasTestDb } from './testing/db.ts';
import { makeUser, MONDAY_8AM } from './testing/fixtures.ts';
import type { DB } from './db/types.ts';
import { profile } from './db/app.schema.ts';
import { familyInvite } from './db/v3.schema.ts';
import {
	activeInvite,
	childrenOf,
	createInvite,
	decidePending,
	FamilyFail,
	loginEmail,
	makeInviteCode,
	normalizeInvite,
	parentAccess,
	previewInvite,
	redeemInvite,
	removeLink,
	revokeInvites,
	setGuardianPermissions,
	setSharing,
	toolsAllowedFor
} from './family.ts';
import { addCheckin, sharedCheckins } from './checkins.ts';
import {
	examReadiness,
	addExam,
	overallProgress,
	recordResult,
	topicScores,
	weakTopics
} from './progress.ts';
import { addPlanItem, endSession, startSession, streak, todaysPlan, weekSummary } from './study.ts';
import { addDays } from '../tz.ts';

describe('invite codes (no database)', () => {
	it('look like AMI-7KQ49P and avoid look-alike characters', () => {
		for (let i = 0; i < 50; i++) {
			const c = makeInviteCode('Amina Dube');
			expect(c).toMatch(/^AMI-[2-9A-HJ-NP-Z]{6}$/);
		}
		expect(makeInviteCode('Ö')).toMatch(/^OTU-/);
		expect(normalizeInvite(' ami-7kq 49p ')).toBe('AMI7KQ49P');
	});
	it('younger children log in with a username', () => {
		expect(loginEmail('Tino.Dube')).toBe('tino.dube@kids.tutora.invalid');
		expect(loginEmail('Mum@Example.com ')).toBe('mum@example.com');
	});
});

describe.skipIf(!hasTestDb)('Family Connection', () => {
	let db: DB;
	let close: () => Promise<void>;
	const now = MONDAY_8AM;

	beforeAll(async () => {
		({ db, close } = await freshDb());
		await makeUser(db, 'tutor', 'Tutor');
	});
	afterAll(async () => close?.());

	async function minor(name: string) {
		const s = await makeUser(db, 'student', name);
		await db
			.update(profile)
			.set({ isUnder18: true, parentName: 'P', parentPhone: '+263770000000' })
			.where(eq(profile.userId, s.id));
		return s;
	}

	it('a code works once, for 48 hours, and can be revoked', async () => {
		const s = await makeUser(db, 'student', 'Amina Dube');
		const p1 = await makeUser(db, 'parent', 'Mrs Dube', null);
		const p2 = await makeUser(db, 'parent', 'Mr Dube', null);
		const { code } = await createInvite(db, s.id, now);
		expect((await previewInvite(db, code, now))?.firstName).toBe('Amina');
		// only a fingerprint is stored
		const [row] = await db.select().from(familyInvite).where(eq(familyInvite.studentId, s.id));
		expect(row.codeHash).not.toContain(normalizeInvite(code));
		await redeemInvite(db, code, p1.id, { guardianClaim: false }, now);
		await expect(redeemInvite(db, code, p2.id, { guardianClaim: false }, now)).rejects.toThrow(
			FamilyFail
		);
		// expired
		const late = await createInvite(db, s.id, now);
		expect(await previewInvite(db, late.code, addDays(now, 2.01))).toBeNull();
		await expect(
			redeemInvite(db, late.code, p2.id, { guardianClaim: false }, addDays(now, 2.01))
		).rejects.toThrow(FamilyFail);
		// revoked
		const r = await createInvite(db, s.id, now);
		await revokeInvites(db, s.id, now);
		expect(await previewInvite(db, r.code, now)).toBeNull();
		expect(await activeInvite(db, s.id, now)).toBeNull();
		// a new code replaces the old one
		const a = await createInvite(db, s.id, now);
		const b = await createInvite(db, s.id, now);
		expect(await previewInvite(db, a.code, now)).toBeNull();
		expect(await previewInvite(db, b.code, now)).not.toBeNull();
	});

	it('only parent accounts can use a code', async () => {
		const s = await makeUser(db, 'student', 'Rudo');
		const other = await makeUser(db, 'student', 'Other');
		const t = await makeUser(db, 'tutor', 'T2');
		const { code } = await createInvite(db, s.id, now);
		await expect(redeemInvite(db, code, other.id, { guardianClaim: false }, now)).rejects.toThrow(
			'fam_err_not_parent'
		);
		await expect(redeemInvite(db, code, t.id, { guardianClaim: false }, now)).rejects.toThrow(
			'fam_err_not_parent'
		);
	});

	it('a parent sees only what each child shares, and switches between two children', async () => {
		const amina = await makeUser(db, 'student', 'Amina');
		const tino = await makeUser(db, 'student', 'Tino');
		const stranger = await makeUser(db, 'student', 'Stranger');
		const mum = await makeUser(db, 'parent', 'Mum', null);
		for (const s of [amina, tino]) {
			const { code } = await createInvite(db, s.id, now);
			await redeemInvite(db, code, mum.id, { guardianClaim: false }, now);
		}
		expect((await childrenOf(db, mum.id)).map((c) => c.name).sort()).toEqual(['Amina', 'Tino']);
		expect((await parentAccess(db, mum.id, stranger.id)).ok).toBe(false);

		// Amina (adult) hides her progress from Mum
		await setSharing(db, amina.id, mum.id, {
			progress: false,
			lessons: true,
			homework: true,
			study: true
		});
		const a = await parentAccess(db, mum.id, amina.id);
		expect(a.ok && !a.progress && a.lessons).toBe(true);

		// check-ins: only shared ones, never the note
		await addCheckin(db, amina.id, { mood: 'finding_hard', shared: true, note: 'secret words' });
		await addCheckin(db, amina.id, { mood: 'need_break', shared: false });
		const shared = await sharedCheckins(db, amina.id, addDays(new Date(), -1));
		expect(shared.map((c) => c.mood)).toEqual(['finding_hard']);
		expect(JSON.stringify(shared)).not.toContain('secret words');

		// leaving ends all access
		await removeLink(db, { role: 'parent', id: mum.id }, tino.id, mum.id);
		expect((await parentAccess(db, mum.id, tino.id)).ok).toBe(false);
	});

	it('under 18: the guardian always sees the basics, approves new family, and manages tools', async () => {
		const kid = await minor('Kuda');
		const mum = await makeUser(db, 'parent', 'Guardian Mum', null);
		const aunt = await makeUser(db, 'parent', 'Aunt', null);
		const c1 = await createInvite(db, kid.id, now);
		const r1 = await redeemInvite(db, c1.code, mum.id, { guardianClaim: true }, now);
		expect(r1.guardian).toBe(true);
		// the child cannot hide lessons or progress from the guardian
		await setSharing(db, kid.id, mum.id, {
			progress: false,
			lessons: false,
			homework: false,
			study: false
		});
		const g = await parentAccess(db, mum.id, kid.id);
		expect(g.progress && g.lessons && g.homework && g.study).toBe(true);
		// and cannot remove the guardian
		await expect(removeLink(db, { role: 'student', id: kid.id }, kid.id, mum.id)).rejects.toThrow(
			'fam_err_guardian_stays'
		);
		// a second parent waits for the guardian
		const c2 = await createInvite(db, kid.id, now);
		const r2 = await redeemInvite(db, c2.code, aunt.id, { guardianClaim: true }, now);
		expect(r2.status).toBe('pending_guardian');
		expect(r2.guardian).toBe(false);
		expect((await parentAccess(db, aunt.id, kid.id)).ok).toBe(false);
		// only the guardian can approve
		await expect(decidePending(db, aunt.id, kid.id, aunt.id, true)).rejects.toThrow(FamilyFail);
		await decidePending(db, mum.id, kid.id, aunt.id, true);
		expect((await parentAccess(db, aunt.id, kid.id)).ok).toBe(true);
		// tools are off for a minor until the guardian allows them
		expect(await toolsAllowedFor(db, kid.id)).toBe(false);
		await expect(
			setGuardianPermissions(db, aunt.id, kid.id, { toolsAllowed: true, approveNewFamily: true })
		).rejects.toThrow(FamilyFail);
		await setGuardianPermissions(db, mum.id, kid.id, {
			toolsAllowed: true,
			approveNewFamily: true
		});
		expect(await toolsAllowedFor(db, kid.id)).toBe(true);
	});
});

describe.skipIf(!hasTestDb)('progress and study from real data only', () => {
	let db: DB;
	let close: () => Promise<void>;
	const now = MONDAY_8AM;

	beforeAll(async () => {
		({ db, close } = await freshDb());
		await makeUser(db, 'tutor', 'Tutor');
	});
	afterAll(async () => close?.());

	it('no results means no numbers', async () => {
		const s = await makeUser(db, 'student', 'Empty');
		expect(await topicScores(db, s.id)).toEqual([]);
		expect((await overallProgress(db, s.id, now)).current).toBeNull();
		expect(await streak(db, s.id, now)).toBe(0);
		expect(await todaysPlan(db, s.id, now)).toEqual([]);
	});

	it('scores per topic use the latest three results; readiness follows them', async () => {
		const s = await makeUser(db, 'student', 'Scores');
		const r = (topic: string, score: number, takenOn: string) =>
			recordResult(db, {
				studentId: s.id,
				source: 'test',
				title: 't',
				subject: 'Maths',
				topic,
				score,
				maxScore: 10,
				takenOn
			});
		await r('Fractions', 2, '2026-10-01'); // old, outside the latest three
		await r('Fractions', 4, '2026-11-10');
		await r('Fractions', 4, '2026-11-11');
		await r('Fractions', 5, '2026-11-12');
		await r('Geometry', 9, '2026-11-12');
		const scores = await topicScores(db, s.id, { weakFirst: true });
		expect(scores[0]).toMatchObject({ topic: 'Fractions', pct: 43, results: 4 });
		expect((await weakTopics(db, s.id)).map((t) => t.topic)).toEqual(['Fractions']);
		await addExam(db, s.id, s.id, {
			subject: 'Maths',
			title: 'November exam',
			examOn: '2026-12-07',
			topics: ['Fractions', 'Geometry', 'Ratio']
		});
		const [e] = await examReadiness(db, s.id, now);
		expect(e.ready).toBe(1);
		expect(e.total).toBe(3);
		expect(e.daysLeft).toBe(21);
		const o = await overallProgress(db, s.id, now);
		expect(o.current?.n).toBe(4);
		expect(o.previous?.pct).toBe(20);
	});

	it('plan, sessions and streak', async () => {
		const s = await makeUser(db, 'student', 'Planner');
		// Monday 08:00: a 16:00 slot is "next"
		const item = await addPlanItem(db, s.id, s.id, {
			weekday: 1,
			startMinute: 16 * 60,
			minutes: 45,
			subject: 'Maths',
			topic: 'Fractions'
		});
		expect((await todaysPlan(db, s.id, now))[0].state).toBe('next');
		const sess = await startSession(
			db,
			s.id,
			{ planItemId: item!.id, subject: '', minutes: 0 },
			now
		);
		expect(sess?.subject).toBe('Maths');
		expect((await todaysPlan(db, s.id, now))[0].state).toBe('now');
		await endSession(db, s.id, sess!.id, true, new Date(now.getTime() + 45 * 60_000));
		expect((await todaysPlan(db, s.id, now))[0].state).toBe('done');
		expect(await streak(db, s.id, now)).toBe(1);
		// yesterday too: streak 2; a gap breaks it
		const y = await startSession(db, s.id, { subject: 'English', minutes: 20 }, addDays(now, -1));
		await endSession(db, s.id, y!.id, true, addDays(now, -1));
		const old = await startSession(db, s.id, { subject: 'English', minutes: 20 }, addDays(now, -3));
		await endSession(db, s.id, old!.id, true, addDays(now, -3));
		expect(await streak(db, s.id, now)).toBe(2);
		const w = await weekSummary(db, s.id, now);
		expect(w).toMatchObject({ planned: 1, done: 1 });
		// someone else cannot finish this student's session
		const other = await makeUser(db, 'student', 'Other');
		const run = await startSession(db, s.id, { subject: 'Science', minutes: 10 }, now);
		expect(await endSession(db, other.id, run!.id, true, now)).toBeNull();
	});
});
