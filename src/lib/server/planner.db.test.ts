import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { freshDb, hasTestDb } from './testing/db.ts';
import { makeUser } from './testing/fixtures.ts';
import type { DB } from './db/types.ts';
import { personalTask } from './db/personal.schema.ts';
import { addActivity } from './schedule.ts';
import {
	addGoal,
	addTask,
	daySummaryLine,
	goals,
	personalInsight,
	removeTask,
	setShareReport,
	shareReport,
	tickGoal,
	tickItem,
	today,
	weekStats
} from './planner.ts';

// Harare is UTC+2; 2026-11-16 is a Monday
const at = (day: number, hh: number) => new Date(Date.UTC(2026, 10, day, hh - 2));

describe.skipIf(!hasTestDb)('personal planner (real database)', () => {
	let db: DB;
	let close: () => Promise<void>;
	beforeAll(async () => {
		({ db, close } = await freshDb());
	});
	afterAll(async () => close?.());

	it("today's plan, ticks, tasks, goals, achievements and the week", async () => {
		const s = await makeUser(db, 'student', 'Planner Kid');
		const other = await makeUser(db, 'student', 'Someone Else');
		const mon = at(16, 7);
		// timetable made the week before
		await addActivity(db, s.id, { kind: 'school', label: '', days: [1, 2], start: 450, end: 810 });
		await addActivity(db, s.id, { kind: 'sleep', label: '', days: [1, 2], start: 1290, end: 1440 });
		expect(
			(
				await addTask(
					db,
					s.id,
					{ title: 'Wake up on time', minute: 390, days: [1, 2], onlyToday: false },
					mon
				)
			).ok
		).toBe(true);
		expect(
			(
				await addTask(
					db,
					s.id,
					{ title: 'Tidy my room', minute: null, days: [], onlyToday: true },
					mon
				)
			).ok
		).toBe(true);
		expect(
			(await addTask(db, s.id, { title: '  ', minute: null, days: [], onlyToday: true }, mon)).ok
		).toBe(false);
		expect(
			(await addTask(db, s.id, { title: 'x', minute: null, days: [], onlyToday: false }, mon)).ok
		).toBe(false);

		let t = await today(db, s.id, mon);
		// school + 2 tasks count; sleep is shown but not counted
		expect(t.items.map((i) => i.kind).sort()).toEqual(['school', 'sleep', 'task', 'task']);
		expect(t.stats).toMatchObject({ planned: 3, done: 0, pct: 0, tasksTotal: 2, tasksDone: 0 });
		const wake = t.items.find((i) => i.title === 'Wake up on time')!;
		const sleep = t.items.find((i) => i.kind === 'sleep')!;
		expect(await tickItem(db, s.id, wake.key, true, mon)).toBe(true);
		expect(await tickItem(db, s.id, sleep.key, true, mon)).toBe(false);
		expect(await tickItem(db, s.id, 'a999999', true, mon)).toBe(false);
		// another student can't tick my items
		expect(await tickItem(db, other.id, wake.key, true, mon)).toBe(false);
		t = await today(db, s.id, mon);
		expect(t.stats).toMatchObject({ done: 1, pct: 33, tasksDone: 1 });
		// "just today" task is gone tomorrow; the repeating one is there
		const tue = await today(db, s.id, at(17, 7));
		expect(tue.items.filter((i) => i.kind === 'task').map((i) => i.title)).toEqual([
			'Wake up on time'
		]);
		// removing a task stops it from now on
		await removeTask(db, s.id, wake.id!);
		expect(
			(await today(db, s.id, at(17, 8))).items.some((i) => i.title === 'Wake up on time')
		).toBe(false);

		// weekly goal: 2 days → reached
		const g = await addGoal(db, s.id, 'Go to bed by 9 PM', 2);
		expect(g.ok).toBe(true);
		expect((await addGoal(db, s.id, 'x', 9)).ok).toBe(false);
		const gid = (await goals(db, s.id, mon)).active[0].id;
		expect(await tickGoal(db, other.id, gid, true, mon)).toBe(false);
		await tickGoal(db, s.id, gid, true, mon);
		let gs = await goals(db, s.id, mon);
		expect(gs.active[0]).toMatchObject({ count: 1, achieved: false, today: true });
		expect(gs.reached).toBe(0);
		await tickGoal(db, s.id, gid, true, at(17, 9));
		gs = await goals(db, s.id, at(17, 10));
		expect(gs.active[0].achieved).toBe(true);
		expect(gs.reached).toBe(1);
		expect(gs.reachedThisWeek).toBe(1);
		// next week it starts again, but the achievement stays
		gs = await goals(db, s.id, at(23, 10));
		expect(gs.active[0]).toMatchObject({ count: 0, achieved: false });
		expect(gs.reached).toBe(1);

		// the week: Monday planned (1 of 3 = 33%, not followed)
		const w = await weekStats(db, s.id, at(17, 20));
		expect(w.daysPlanned).toBe(2);
		expect(w.daysFollowed).toBe(0);
		expect(w.consistency).toBe(0);
		expect(personalInsight(w, 1)).toEqual({ key: 'pr_ins_goals', n: 1 });
		expect(daySummaryLine(t.stats, null, null)).toEqual({ key: 'pr_day_some', n: 1 });

		// sharing the report is the child's choice; off by default
		expect(await shareReport(db, s.id)).toBe(false);
		await setShareReport(db, s.id, true);
		expect(await shareReport(db, s.id)).toBe(true);
		void personalTask;
	});
});
