import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshDb, hasTestDb } from './testing/db.ts';
import { makeUser } from './testing/fixtures.ts';
import type { DB } from './db/types.ts';
import { addSubject } from './settings.ts';
import { review, supportRequest, tutorProfile } from './db/app.schema.ts';
import {
	addPlatformSubject,
	allTutors,
	audit,
	closeSupport,
	listPlatformSubjects,
	removePlatformSubject,
	reopenSupport,
	reportedReviews,
	reviewLabel,
	setTutorStatus,
	tutorReadiness
} from './owner.ts';
import { setReviewHidden } from './people.ts';

describe.skipIf(!hasTestDb)('owner admin', () => {
	let db: DB;
	let close: () => Promise<void>;
	let owner: string;

	beforeAll(async () => {
		({ db, close } = await freshDb());
		owner = (await makeUser(db, 'owner', 'The Owner')).id;
	});
	afterAll(async () => close?.());

	it('a tutor with no subjects is not ready for Find (and is flagged on the owner list)', async () => {
		const t = (await makeUser(db, 'tutor', 'Not Ready Yet')).id;
		await setTutorStatus(db, t, 'pending');
		expect(await tutorReadiness(db, t)).toEqual({ ready: false, missing: ['subjects'] });
		let row = (await allTutors(db)).find((x) => x.tutorId === t)!;
		expect(row.findable).toBe(false);
		await addSubject(db, t, { name: 'Chemistry', levels: '', price: 1000 });
		expect((await tutorReadiness(db, t)).ready).toBe(true);
		row = (await allTutors(db)).find((x) => x.tutorId === t)!;
		expect(row.findable).toBe(true);
		expect(row.activeSubjects).toBe(1);
	});

	it('a tutor without a public name is not ready either', async () => {
		const t = (await makeUser(db, 'tutor', 'Nameless')).id;
		await addSubject(db, t, { name: 'Maths', levels: '', price: 1000 });
		await db.update(tutorProfile).set({ tutorName: null }).where(eq(tutorProfile.tutorId, t));
		expect(await tutorReadiness(db, t)).toEqual({ ready: false, missing: ['name'] });
	});

	it('subjects: same name with other capitals or spaces is refused; removing returns the name', async () => {
		expect(await addPlatformSubject(db, 'Ancient Pottery')).toBe('added');
		expect(await addPlatformSubject(db, '  ancient   pottery ')).toBe('exists');
		expect(await addPlatformSubject(db, 'Modern Pottery')).toBe('added');
		const list = await listPlatformSubjects(db);
		expect(list.filter((s) => s.name.toLowerCase() === 'ancient pottery')).toHaveLength(1);
		const g = list.find((s) => s.name === 'Ancient Pottery')!;
		expect(await removePlatformSubject(db, g.id)).toBe('Ancient Pottery');
		expect(await removePlatformSubject(db, g.id)).toBeNull();
	});

	it('a review the owner showed again stays on the list, so it can be hidden again', async () => {
		const t = (await makeUser(db, 'tutor', 'Reviewed Tutor')).id;
		const s = (await makeUser(db, 'student', 'Reviewer', t)).id;
		const [r] = await db
			.insert(review)
			.values({
				tutorId: t,
				userId: s,
				displayName: 'R.',
				rating: 2,
				text: 'Not great',
				hidden: true,
				reportedAt: new Date(),
				reportReason: 'rude'
			})
			.returning({ id: review.id });
		// the owner shows it again: the report is kept and it is still listed
		await setReviewHidden(db, r.id, false);
		await audit(db, owner, 'review_shown', String(r.id), await reviewLabel(db, r.id));
		const row = (await reportedReviews(db)).find((x) => x.id === r.id)!;
		expect(row.hidden).toBe(false);
		expect(row.reportReason).toBe('rude');
		expect(row.handled).toBe(true);
		expect(await reviewLabel(db, r.id)).toContain('Reviewed Tutor');
	});

	it('a help request marked done by mistake can be opened again', async () => {
		const [h] = await db
			.insert(supportRequest)
			.values({ name: 'Asker', email: 'a@example.com', topic: 'help', message: 'Please help' })
			.returning({ id: supportRequest.id });
		expect(await closeSupport(db, h.id)).toEqual({ name: 'Asker', topic: 'help' });
		expect(await reopenSupport(db, h.id)).toEqual({ name: 'Asker', topic: 'help' });
		const [after] = await db.select().from(supportRequest).where(eq(supportRequest.id, h.id));
		expect(after.status).toBe('open');
		expect(await reopenSupport(db, 999_999)).toBeNull();
	});
});
