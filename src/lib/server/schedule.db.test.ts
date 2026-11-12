import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { freshDb, hasTestDb } from './testing/db.ts';
import { makeUser } from './testing/fixtures.ts';
import type { DB } from './db/types.ts';
import { addActivity, removeActivity, tipsFor, weekBlocks, type Block } from './schedule.ts';

const b = (
	kind: Block['kind'],
	start: number,
	end: number,
	label: string | null = null
): Block => ({
	key: `${kind}${start}`,
	id: 1,
	kind,
	label,
	subject: kind === 'study' ? 'Maths' : null,
	start,
	end
});

describe('schedule tips (plain words, from the timetable itself)', () => {
	it('flags overlaps, long study stretches, no meal, no rest, late study', () => {
		const keys = (d: Block[]) => tipsFor(d).map((x) => x.key);
		expect(keys([])).toEqual([]);
		expect(keys([b('school', 450, 810), b('meal', 810, 840)])).toEqual([]);
		expect(keys([b('school', 450, 810), b('sport', 800, 900), b('meal', 900, 930)])).toEqual([
			'ps_tip_overlap'
		]);
		expect(keys([b('study', 900, 960), b('study', 960, 1020), b('meal', 1100, 1130)])).toEqual([
			'ps_tip_break',
			'ps_tip_rest'
		]);
		expect(keys([b('study', 1260, 1320), b('break', 1200, 1210)])).toEqual([
			'ps_tip_meal',
			'ps_tip_late'
		]);
	});
});

describe.skipIf(!hasTestDb)('personal schedule (real database)', () => {
	let db: DB;
	let close: () => Promise<void>;
	beforeAll(async () => {
		({ db, close } = await freshDb());
	});
	afterAll(async () => close?.());

	it('adds activities on the chosen days, checks times, and only the owner removes', async () => {
		const s = await makeUser(db, 'student', 'Sched Student');
		const other = await makeUser(db, 'student', 'Other Student');
		expect(
			(
				await addActivity(db, s.id, {
					kind: 'school',
					label: '',
					days: [1, 2],
					start: 450,
					end: 810
				})
			).ok
		).toBe(true);
		expect(
			await addActivity(db, s.id, { kind: 'meal', label: '', days: [], start: 800, end: 830 })
		).toEqual({ ok: false, error: 'ps_err_days' });
		expect(
			await addActivity(db, s.id, { kind: 'meal', label: '', days: [1], start: 830, end: 800 })
		).toEqual({ ok: false, error: 'ps_err_time' });
		const week = await weekBlocks(db, s.id);
		expect(week[1]).toHaveLength(1);
		expect(week[3]).toHaveLength(0);
		await removeActivity(db, other.id, week[1][0].id!);
		expect((await weekBlocks(db, s.id))[1]).toHaveLength(1);
		await removeActivity(db, s.id, week[1][0].id!);
		expect((await weekBlocks(db, s.id))[1]).toHaveLength(0);
	});
});
