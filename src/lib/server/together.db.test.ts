import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshDb, hasTestDb } from './testing/db.ts';
import { makeUser } from './testing/fixtures.ts';
import type { DB } from './db/types.ts';
import { tutorProfile } from './db/app.schema.ts';
import { assessmentResult } from './db/v3.schema.ts';
import { together } from './together.ts';
import { listTutors } from './settings.ts';
import { myTutors } from './student-tutors.ts';

describe.skipIf(!hasTestDb)('you and your tutor; services filter (real database)', () => {
	let db: DB;
	let close: () => Promise<void>;
	beforeAll(async () => {
		({ db, close } = await freshDb());
	});
	afterAll(async () => close?.());

	it('only for a real tutor–student pair, with marks then and now', async () => {
		const t = await makeUser(db, 'tutor', 'Mrs Pair');
		const other = await makeUser(db, 'tutor', 'Mr Other');
		const s = await makeUser(db, 'student', 'Pair Student', t.id);
		expect(await together(db, s.id, other.id)).toBeNull();
		const scores = [5, 6, 5, 8, 9, 9];
		for (const [i, sc] of scores.entries())
			await db.insert(assessmentResult).values({
				studentId: s.id,
				tutorId: t.id,
				source: 'quiz',
				title: `Quiz ${i}`,
				subject: 'Maths',
				topic: i < 3 ? 'Fractions' : 'Equations',
				score: sc,
				maxScore: 10,
				takenOn: `2026-10-0${i + 1}`
			});
		const g = await together(db, s.id, t.id);
		expect(g).toMatchObject({ results: 6, topics: 2, marks: { first: 53, latest: 87 } });
		expect((await myTutors(db, s.id)).map((x) => x.tutorId)).toEqual([t.id]);
	});

	it('Find a tutor filters by the kind of help', async () => {
		const a = await makeUser(db, 'tutor', 'Homework Helper');
		await db
			.update(tutorProfile)
			.set({ services: ['homework'] })
			.where(eq(tutorProfile.tutorId, a.id));
		const names = (await listTutors(db, { service: 'homework' })).map((x) => x.name);
		expect(names).toContain('Homework Helper');
		expect(names).not.toContain('Mr Other');
	});
});
