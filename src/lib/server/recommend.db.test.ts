import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshDb, hasTestDb } from './testing/db.ts';
import { makeUser } from './testing/fixtures.ts';
import type { DB } from './db/types.ts';
import { availability, profile, subject, tutorProfile } from './db/app.schema.ts';
import { familyLink, schoolSubject } from './db/v3.schema.ts';
import { auditLog } from './db/app.schema.ts';
import {
	levelBands,
	rankFor,
	recommendationsFor,
	setRecommendMode,
	teachesLevel,
	type PoolTutor
} from './recommend.ts';
import { saveTutoraSettings } from './family-billing.ts';
import { forgetShared } from './cache.ts';

const tutor = (over: Partial<PoolTutor> & { slug: string }): PoolTutor => ({
	tutorId: over.slug,
	name: over.slug,
	hasPhoto: false,
	photoVersion: 0,
	subjects: ['Mathematics'],
	levels: ['O Level'],
	rating: null,
	reviewCount: 0,
	lessonCount: 0,
	verified: true,
	weeklyHours: 4,
	mode: null,
	...over
});

describe('recommended tutors: matching and order (no database)', () => {
	it('puts Zimbabwe levels in bands, so Form 3 matches O Level', () => {
		expect(levelBands('Form 3')).toEqual(['olevel']);
		expect(levelBands('Grade 7')).toEqual(['primary']);
		expect(levelBands('Upper Six')).toEqual(['alevel']);
		expect(teachesLevel(['O Level', 'A Level'], 'Form 3')).toBe(true);
		expect(teachesLevel(['Grade 7'], 'Form 3')).toBe(false);
		expect(teachesLevel([], 'Form 3')).toBe(true);
		expect(teachesLevel(['Grade 7'], null)).toBe(true);
	});

	it('matches subjects and level, leaves out hidden and excluded tutors, max 5', () => {
		const pool = [
			tutor({ slug: 'maths-a', subjects: ['Mathematics'] }),
			tutor({ slug: 'eng', subjects: ['English Language'] }),
			tutor({ slug: 'primary', subjects: ['Mathematics'], levels: ['Grade 7'] }),
			tutor({ slug: 'hidden', mode: 'hidden' }),
			tutor({ slug: 'mine' }),
			...['b', 'c', 'd', 'e', 'f'].map((x) => tutor({ slug: `maths-${x}` }))
		];
		const got = rankFor(pool, {
			subjects: ['Mathematics'],
			level: 'Form 3',
			exclude: ['mine']
		});
		expect(got).toHaveLength(5);
		const slugs = got.map((t) => t.slug);
		for (const no of ['eng', 'primary', 'hidden', 'mine']) expect(slugs).not.toContain(no);
	});

	it('orders pinned, then more matched subjects, rating, verified, open times', () => {
		const pool = [
			tutor({ slug: 'no-times', weeklyHours: 0 }),
			tutor({ slug: 'unverified', verified: false }),
			tutor({ slug: 'rated', rating: 4.8, reviewCount: 5 }),
			tutor({ slug: 'both', subjects: ['Mathematics', 'Physics'] }),
			tutor({ slug: 'pinned', mode: 'pinned' })
		];
		const got = rankFor(pool, {
			subjects: ['Mathematics', 'Physics'],
			level: 'O Level',
			exclude: []
		});
		expect(got.map((t) => t.slug)).toEqual(['pinned', 'both', 'rated', 'no-times', 'unverified']);
		expect(got[0].pinned).toBe(true);
		expect(got[1].subjects).toEqual(['Mathematics', 'Physics']);
	});

	it('with no school subjects yet, any tutor at the right level', () => {
		const got = rankFor([tutor({ slug: 'a', subjects: ['History'] })], {
			subjects: [],
			level: 'Form 2',
			exclude: []
		});
		expect(got.map((t) => t.slug)).toEqual(['a']);
	});
});

describe.skipIf(!hasTestDb)('recommended tutors (database)', () => {
	let db: DB;
	let close: () => Promise<void>;
	beforeAll(async () => {
		({ db, close } = await freshDb());
	});
	afterAll(async () => close?.());

	async function mathsTutor(name: string, opts: { hours?: boolean } = {}) {
		const t = await makeUser(db, 'tutor', name);
		await db
			.insert(subject)
			.values({ tutorId: t.id, name: 'Mathematics', levels: 'O Level', priceCents: 1000 });
		if (opts.hours)
			await db
				.insert(availability)
				.values({ tutorId: t.id, weekday: 1, startMinute: 900, endMinute: 1020 });
		return t;
	}

	it('Family children get matching tutors (not their own), free children a teaser only', async () => {
		await saveTutoraSettings(db, { pilotFreeTrial: true, trialDays: 30 });
		const own = await mathsTutor('Own Tutor');
		const others = [
			await mathsTutor('Rec One', { hours: true }),
			await mathsTutor('Rec Two'),
			await mathsTutor('Rec Three')
		];
		const parent = await makeUser(db, 'parent', 'Rec Parent', null);
		const kid = await makeUser(db, 'student', 'Rec Kid', own.id);
		await db.update(profile).set({ level: 'Form 3' }).where(eq(profile.userId, kid.id));
		await db
			.insert(familyLink)
			.values({ parentId: parent.id, studentId: kid.id, status: 'active' });
		await db.insert(schoolSubject).values({ studentId: kid.id, subject: 'Mathematics' });
		forgetShared('rec:');

		const rec = (await recommendationsFor(db, parent.id, [kid.id])).get(kid.id)!;
		expect(rec.locked).toBe(false);
		if (rec.locked) return;
		const names = rec.tutors.map((t) => t.name);
		expect(names).not.toContain('Own Tutor');
		for (const o of others) expect(names).toContain(o.name);
		expect(rec.tutors[0].name).toBe('Rec One'); // the one with open times
		expect(rec.tutors.length).toBeLessThanOrEqual(5);

		// owner pins and hides (logged); a suspended tutor is never shown
		const owner = await makeUser(db, 'owner', 'Rec Owner');
		await setRecommendMode(db, owner.id, others[2].id, 'pinned');
		await setRecommendMode(db, owner.id, others[0].id, 'hidden');
		await db
			.update(tutorProfile)
			.set({ status: 'suspended' })
			.where(eq(tutorProfile.tutorId, others[1].id));
		forgetShared('rec:');
		const again = (await recommendationsFor(db, parent.id, [kid.id])).get(kid.id)!;
		if (again.locked) throw new Error('locked');
		expect(again.tutors.map((t) => t.name)).toEqual(['Rec Three']);
		expect(again.tutors[0].pinned).toBe(true);
		const log = await db.select().from(auditLog).where(eq(auditLog.actorId, owner.id));
		expect(log.map((l) => l.action).sort()).toEqual(['recommend_hidden', 'recommend_pinned']);
		await setRecommendMode(db, owner.id, others[0].id, 'normal');
		forgetShared('rec:');
		const back = (await recommendationsFor(db, parent.id, [kid.id])).get(kid.id)!;
		if (back.locked) throw new Error('locked');
		expect(back.tutors.map((t) => t.name)).toContain('Rec One');

		// pilot off and no plan: locked teaser without names
		await saveTutoraSettings(db, { pilotFreeTrial: false, trialDays: 30 });
		const locked = (await recommendationsFor(db, parent.id, [kid.id])).get(kid.id)!;
		expect(locked).toMatchObject({ locked: true });
		expect(JSON.stringify(locked)).not.toContain('Rec Three');
		await saveTutoraSettings(db, { pilotFreeTrial: true, trialDays: 30 });
	});
});
