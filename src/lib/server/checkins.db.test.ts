import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshDb, hasTestDb } from './testing/db.ts';
import { makeUser } from './testing/fixtures.ts';
import type { DB } from './db/types.ts';
import { checkin, studySession } from './db/v3.schema.ts';
import {
	addCheckin,
	answerShare,
	daySummaries,
	insightFor,
	recentForTutor,
	sendCheckinFollowups,
	sendDaySummaries,
	sharedCheckins,
	sharePref,
	todayState,
	toughDaysInARow,
	weekPattern
} from './checkins.ts';
import { NEXT_STEP, MOOD_LEVEL, responseKey, followupKey } from '../checkin-copy.ts';
import { CHECKIN_MOODS } from '../checkin-moods.ts';
import en from '../../../messages/en.json' with { type: 'json' };

// 2026-11-16 is a Monday; Harare is UTC+2
const at = (day: number, hh: number, mm = 0) => new Date(Date.UTC(2026, 10, day, hh - 2, mm));

describe('check-in words come from the reviewed list', () => {
	it('every mood has a response (with and without a plan), a next step and a follow-up', () => {
		const msgs = en as Record<string, string>;
		for (const md of CHECKIN_MOODS) {
			expect(msgs[responseKey(md, true)]).toContain('{subject}');
			expect(msgs[responseKey(md, false)]).toBeTruthy();
			expect(msgs[NEXT_STEP[md].key]).toBeTruthy();
			expect(msgs[followupKey(md)]).toBeTruthy();
			expect(MOOD_LEVEL[md]).toBeGreaterThanOrEqual(0);
		}
	});
	it('insights only say what the data shows', () => {
		expect(insightFor([], ['confident'])).toBeNull();
		const d = (start: string | null, end: string | null, studied = false) => ({
			date: 'x',
			start: start as never,
			end: end as never,
			studied
		});
		expect(
			insightFor(
				[d('finding_hard', 'confident'), d('need_help', 'motivated'), d(null, null)],
				['finding_hard', 'confident', 'need_help', 'motivated']
			)
		).toEqual({ key: 'ck_ins_better', n: 2 });
	});
});

describe.skipIf(!hasTestDb)('learning check-ins (real database)', () => {
	let db: DB;
	let close: () => Promise<void>;
	beforeAll(async () => {
		({ db, close } = await freshDb());
	});
	afterAll(async () => close?.());

	it('follow-up after a session or at 7 PM; once; share choice remembered; parents see only shared', async () => {
		const s = await makeUser(db, 'student', 'Rudo Test');
		const sent: { to: string; title: string }[] = [];
		const notify = async (to: string, title: string) => {
			sent.push({ to, title });
		};
		const morning = at(16, 9);
		const start = await addCheckin(db, s.id, {
			mood: 'finding_hard',
			shared: await sharePref(db, s.id),
			subject: 'Mathematics'
		});
		expect(start.sharedWithFamily).toBe(false);
		await setCreated(db, start.id, morning);
		// not yet: no session ended, before 7 PM
		expect((await todayState(db, s.id, at(16, 12))).askFollowup).toBe(false);
		await sendCheckinFollowups(db, notify, at(16, 12));
		expect(sent).toHaveLength(0);
		// a study session ends after the check-in → ask
		await db.insert(studySession).values({
			studentId: s.id,
			subject: 'Mathematics',
			topic: 'Fractions',
			plannedMinutes: 30,
			startedAt: at(16, 15),
			endedAt: at(16, 15, 30),
			status: 'done'
		});
		expect((await todayState(db, s.id, at(16, 16))).askFollowup).toBe(true);
		await sendCheckinFollowups(db, notify, at(16, 16));
		await sendCheckinFollowups(db, notify, at(16, 17)); // no repeat
		expect(sent.filter((x) => x.to === s.id)).toHaveLength(1);

		// "Share with my parent?" yes: this one shared and remembered for the next
		await answerShare(db, s.id, start.id, true);
		expect(await sharePref(db, s.id)).toBe(true);
		const fu = await addCheckin(db, s.id, {
			mood: 'confident',
			shared: await sharePref(db, s.id),
			kind: 'followup',
			followupOf: start.id,
			note: 'private words'
		});
		await setCreated(db, fu.id, at(16, 18));
		expect(fu.sharedWithFamily).toBe(true);
		const st = await todayState(db, s.id, at(16, 19, 30));
		expect(st.followup?.id).toBe(fu.id);
		expect(st.askFollowup).toBe(false);
		// family sees shared check-ins only, never the note
		const shared = await sharedCheckins(db, s.id, at(16, 0));
		expect(shared.map((x) => x.mood).sort()).toEqual(['confident', 'finding_hard']);
		expect(JSON.stringify(shared)).not.toContain('private words');
		await answerShare(db, s.id, fu.id, false);
		expect((await sharedCheckins(db, s.id, at(16, 0))).map((x) => x.mood)).toEqual([
			'finding_hard'
		]);

		// tutor brief: the latest check-ins
		expect((await recentForTutor(db, s.id, at(16, 20))).map((r) => r.mood)).toEqual([
			'confident',
			'finding_hard'
		]);

		// the day summary
		const { days } = await daySummaries(db, s.id, {}, at(16, 21));
		expect(days[0]).toMatchObject({
			date: '2026-11-16',
			startMood: 'finding_hard',
			endMood: 'confident',
			sessions: 1,
			topics: ['Mathematics · Fractions'],
			streak: 1,
			line: { key: 'ds_line_better' }
		});
		// end-of-day note: from 8 PM, once
		await sendDaySummaries(db, notify, at(16, 19));
		await sendDaySummaries(db, notify, at(16, 20, 7));
		await sendDaySummaries(db, notify, at(16, 21, 7));
		expect(sent.filter((x) => x.to === s.id)).toHaveLength(2);

		// the week chart
		const w = await weekPattern(db, s.id, at(16, 21));
		expect(w.days.at(-1)).toMatchObject({ start: 'finding_hard', end: 'confident', studied: true });
	});

	it('7 PM follow-up without a session; 3 tough days in a row → suggest talking', async () => {
		const s = await makeUser(db, 'student', 'Tino Test');
		for (const day of [14, 15, 16]) {
			const c = await addCheckin(db, s.id, {
				mood: day === 15 ? 'need_help' : 'finding_hard',
				shared: false
			});
			await setCreated(db, c.id, at(day, 10));
		}
		expect(await toughDaysInARow(db, s.id, at(16, 12))).toBe(3);
		// a good day breaks the run
		const ok = await addCheckin(db, s.id, { mood: 'confident', shared: false });
		await setCreated(db, ok.id, at(13, 10));
		expect(await toughDaysInARow(db, s.id, at(17, 12))).toBe(3); // ends yesterday still counts
		expect(await toughDaysInARow(db, s.id, at(19, 12))).toBe(0);
		expect((await todayState(db, s.id, at(16, 18, 59))).askFollowup).toBe(false);
		expect((await todayState(db, s.id, at(16, 19, 0))).askFollowup).toBe(true);
	});
});

async function setCreated(db: DB, id: number, when: Date) {
	await db.update(checkin).set({ createdAt: when }).where(eq(checkin.id, id));
}
