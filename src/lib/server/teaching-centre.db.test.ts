import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { freshDb, hasTestDb } from './testing/db.ts';
import { makeUser } from './testing/fixtures.ts';
import type { DB } from './db/types.ts';
import { assessmentResult } from './db/v3.schema.ts';
import { studentCards } from './tutor-students.ts';
import { teachingCentre } from './teaching-centre.ts';

describe.skipIf(!hasTestDb)('teacher students and teaching centre (real database)', () => {
	let db: DB;
	let close: () => Promise<void>;
	beforeAll(async () => {
		({ db, close } = await freshDb());
	});
	afterAll(async () => close?.());

	it('only the tutor’s own students; real improvement and honest achievements', async () => {
		const t = await makeUser(db, 'tutor', 'Mrs Centre');
		const other = await makeUser(db, 'tutor', 'Mr Elsewhere');
		const a = await makeUser(db, 'student', 'Ana Improving', t.id);
		await makeUser(db, 'student', 'Ben Other', other.id);
		for (const [i, sc] of [4, 5, 5, 8, 9, 9].entries())
			await db.insert(assessmentResult).values({
				studentId: a.id,
				tutorId: t.id,
				source: 'quiz',
				title: `Q${i}`,
				subject: 'Maths',
				topic: 'Fractions',
				score: sc,
				maxScore: 10,
				takenOn: `2026-10-0${i + 1}`
			});
		const { cards, insights } = await studentCards(db, t.id);
		expect(cards.map((c) => c.name)).toEqual(['Ana Improving']);
		expect(cards[0]).toMatchObject({ status: 'pending', firstPct: 47, latestPct: 87 });
		expect(insights).toMatchObject({ avgPct: 87, onTrackPct: 100, improving: 1 });
		const c = await teachingCentre(db, t.id);
		expect(c.improved).toEqual([
			expect.objectContaining({ name: 'Ana Improving', first: 47, latest: 87 })
		]);
		// nothing taught yet: no achievement is claimed
		expect(c.achievements.filter((x) => x.earned)).toEqual([]);
		expect(c.lessonsDone).toBe(0);
	});
});
