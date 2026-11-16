import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshDb, hasTestDb } from './testing/db.ts';
import { makeUser } from './testing/fixtures.ts';
import type { DB } from './db/types.ts';
import { booking, payment, tutorProfile } from './db/app.schema.ts';
import { user } from './db/auth.schema.ts';
import { buddyBlock } from './db/buddies.schema.ts';
import { partnership } from './db/v3.schema.ts';
import {
	blockList,
	bookingList,
	overviewCounts,
	pageFrom,
	partnershipList,
	paymentList,
	peopleList,
	suspendedList,
	tutorCounts
} from './owner-admin.ts';
import { allTutors, setStudentSuspended, setTutorStatus } from './owner.ts';
import { clearPhoto, photoFor, photoVersions, setPhoto } from './photos.ts';
import { photoSrc } from '#lib/photo-slots.ts';

describe.skipIf(!hasTestDb)('owner admin lists', () => {
	let db: DB;
	let close: () => Promise<void>;
	let owner: string;
	let tutor: string;

	beforeAll(async () => {
		({ db, close } = await freshDb());
		owner = (await makeUser(db, 'owner', 'The Owner')).id;
		tutor = (await makeUser(db, 'tutor', 'Listed Tutor')).id;
	});
	afterAll(async () => close?.());

	it('the page number comes from the address, 25 a page', () => {
		expect(pageFrom(new URL('http://x/owner/tutors'))).toEqual({ page: 1, limit: 25, offset: 0 });
		expect(pageFrom(new URL('http://x/?page=3'))).toEqual({ page: 3, limit: 25, offset: 50 });
		expect(pageFrom(new URL('http://x/?page=-4')).page).toBe(1);
		expect(pageFrom(new URL('http://x/?page=abc')).page).toBe(1);
	});

	it('students, parents and teachers are listed apart, with search, filters and paging', async () => {
		const ids: string[] = [];
		for (let i = 0; i < 27; i++)
			ids.push((await makeUser(db, 'student', `Paging Student ${i}`, tutor)).id);
		const par = (await makeUser(db, 'parent', 'Searchable Parent', null)).id;
		const teach = (await makeUser(db, 'schoolteacher', 'Mrs Teacher')).id;

		const first = await peopleList(db, 'student', { q: 'Paging Student', limit: 25 });
		expect(first.rows).toHaveLength(25);
		expect(first.total).toBe(27);
		expect(first.rows[0].extra).toBe(1); // one tutor each
		const second = await peopleList(db, 'student', { q: 'Paging Student', limit: 25, offset: 25 });
		expect(second.rows).toHaveLength(2);

		// a parent is never on the students list, and the other way round
		expect((await peopleList(db, 'student', { q: 'Searchable' })).rows).toHaveLength(0);
		expect((await peopleList(db, 'parent', { q: 'searchable' })).rows.map((r) => r.id)).toEqual([
			par
		]);
		expect((await peopleList(db, 'schoolteacher')).rows.map((r) => r.id)).toContain(teach);

		// a "%" in the search is a plain character, not "anything"
		expect((await peopleList(db, 'student', { q: '%' })).rows).toHaveLength(0);

		// suspended / active filters and their counts
		expect(await setStudentSuspended(db, ids[0], true)).toBe(true);
		const s = await peopleList(db, 'student', { q: 'Paging Student', state: 'suspended' });
		expect(s.rows.map((r) => r.id)).toEqual([ids[0]]);
		expect(s.counts).toEqual({ all: 27, active: 26, suspended: 1 });
		// a schoolteacher can be suspended too (and restored)
		expect(await setStudentSuspended(db, teach, true)).toBe(true);
		expect(await setStudentSuspended(db, teach, false)).toBe(true);
		// the owner can never be suspended this way
		expect(await setStudentSuspended(db, owner, true)).toBe(false);
	});

	it('tutors: one status, a search and the counts for each chip', async () => {
		const w = (await makeUser(db, 'tutor', 'Waiting Wanjiru')).id;
		await setTutorStatus(db, w, 'pending');
		const pending = await allTutors(db, { status: 'pending' });
		expect(pending.every((t) => t.status === 'pending')).toBe(true);
		expect(pending.map((t) => t.tutorId)).toContain(w);
		expect((await allTutors(db, { q: 'wanjiru' })).map((t) => t.tutorId)).toEqual([w]);
		const c = await tutorCounts(db);
		expect(c.pending).toBeGreaterThanOrEqual(1);
		expect(c['']).toBe((await allTutors(db)).length);
		// an unknown status is ignored (all tutors)
		expect((await allTutors(db, { status: 'nonsense' })).length).toBe(c['']);
	});

	it('bookings: status counts, search by student or tutor, upcoming / past', async () => {
		const s = (await makeUser(db, 'student', 'Booking Bongani', tutor)).id;
		const soon = new Date(Date.now() + 2 * 86400_000);
		const ago = new Date(Date.now() - 2 * 86400_000);
		await db.insert(booking).values([
			{
				tutorId: tutor,
				userId: s,
				mode: 'online',
				startsAt: soon,
				endsAt: soon,
				status: 'accepted'
			},
			{ tutorId: tutor, userId: s, mode: 'online', startsAt: ago, endsAt: ago, status: 'declined' }
		]);
		const all = await bookingList(db, { q: 'bongani' });
		expect(all.rows).toHaveLength(2);
		expect(all.counts).toMatchObject({ '': 2, accepted: 1, declined: 1 });
		expect((await bookingList(db, { q: 'bongani', status: 'accepted' })).rows).toHaveLength(1);
		expect((await bookingList(db, { q: 'bongani', when: 'past' })).rows[0].status).toBe('declined');
		expect((await bookingList(db, { q: 'listed tutor' })).rows.length).toBeGreaterThanOrEqual(2);
		const o = await overviewCounts(db);
		expect(o.lessonsWeek).toBeGreaterThanOrEqual(1);
	});

	it('payments: "not confirmed after 7 days" is its own filter and shows on the overview', async () => {
		const s = (await makeUser(db, 'student', 'Paying Pamela', tutor)).id;
		const base = {
			tutorId: tutor,
			userId: s,
			amountCents: 1500,
			currency: 'USD' as const,
			method: 'cash' as const,
			paidOn: '2026-11-01',
			recordedBy: 'student' as const
		};
		await db.insert(payment).values([
			{ ...base, status: 'pending', createdAt: new Date(Date.now() - 9 * 86400_000) },
			{ ...base, status: 'pending' },
			{ ...base, status: 'confirmed', receiptNo: 424242 }
		]);
		const r = await paymentList(db, { q: 'pamela' });
		expect(r.counts).toMatchObject({ '': 3, pending: 2, stale: 1, confirmed: 1, rejected: 0 });
		const stale = await paymentList(db, { q: 'pamela', status: 'stale' });
		expect(stale.rows).toHaveLength(1);
		expect(stale.rows[0].stale).toBe(true);
		expect((await paymentList(db, { q: '424242' })).rows).toHaveLength(1);
		expect((await overviewCounts(db)).paymentsStale).toBeGreaterThanOrEqual(1);
	});

	it('School+: every status, "in progress" groups the ones waiting for an answer', async () => {
		const st = (await makeUser(db, 'student', 'SP Student', tutor)).id;
		const pa = (await makeUser(db, 'parent', 'SP Parent', null)).id;
		const row = {
			studentId: st,
			parentId: pa,
			tutorId: tutor,
			subject: 'Maths',
			schoolName: 'Hill School',
			teacherName: 'Mr Moyo'
		};
		await db.insert(partnership).values([
			{ ...row, status: 'requested' },
			{ ...row, status: 'teacher_invited' },
			{ ...row, status: 'active' },
			{ ...row, status: 'ended' }
		]);
		const all = await partnershipList(db);
		expect(all.counts).toMatchObject({ '': 4, waiting: 2, active: 1, ended: 1 });
		const waiting = await partnershipList(db, { status: 'waiting' });
		expect(waiting.rows.map((r) => r.status).sort()).toEqual(['requested', 'teacher_invited']);
		expect(waiting.rows[0].tutorName).toBe('Listed Tutor');
		expect(waiting.rows[0].parentName).toBe('SP Parent');
		expect((await overviewCounts(db)).schoolPlusWaiting).toBe(2);
	});

	it('safety: buddy blocks and suspended accounts (tutors too)', async () => {
		const a = (await makeUser(db, 'student', 'Blocker Bee', tutor)).id;
		const b = (await makeUser(db, 'student', 'Blocked Bob', tutor)).id;
		await db.insert(buddyBlock).values({ blockerId: a, blockedId: b });
		const blocks = await blockList(db);
		expect(blocks[0]).toMatchObject({ blocker: 'Blocker Bee', blocked: 'Blocked Bob' });

		const t = (await makeUser(db, 'tutor', 'Paused Tutor')).id;
		await setTutorStatus(db, t, 'suspended');
		const list = await suspendedList(db);
		expect(list.find((x) => x.id === t)?.role).toBe('tutor');
		// deleted accounts are not listed
		const gone = (await makeUser(db, 'student', 'Gone', tutor)).id;
		await db
			.update(user)
			.set({ email: `${gone}@deleted.invalid`, suspendedAt: new Date() })
			.where(eq(user.id, gone));
		expect((await suspendedList(db)).some((x) => x.id === gone)).toBe(false);
		const o = await overviewCounts(db);
		expect(o.blocks).toBe(1);
		await db.update(tutorProfile).set({ status: 'active' }).where(eq(tutorProfile.tutorId, t));
	});

	it('photos: a slot gets a new version each time, and goes back to the standard photo', async () => {
		expect(photoSrc(await photoVersions(db), 'parent_home')).toBe('/photos/family-study.webp');
		expect(
			await setPhoto(db, 'parent_home', { storageKey: 'public/a.webp', credit: 'Me', setBy: owner })
		).toBeNull();
		const v1 = (await photoFor(db, 'parent_home'))!;
		expect(v1).toMatchObject({ storageKey: 'public/a.webp', credit: 'Me', rightsConfirmed: true });
		expect(photoSrc(await photoVersions(db), 'parent_home')).toBe(
			`/photo/parent_home?v=${v1.version}`
		);
		// replacing returns the old file (to delete) and changes the version
		expect(
			await setPhoto(db, 'parent_home', { storageKey: 'public/b.webp', credit: null, setBy: owner })
		).toBe('public/a.webp');
		const v2 = (await photoFor(db, 'parent_home'))!;
		expect(v2.version).toBeGreaterThan(v1.version);
		expect(await clearPhoto(db, 'parent_home')).toBe('public/b.webp');
		expect(await clearPhoto(db, 'parent_home')).toBeNull();
		expect(photoSrc(await photoVersions(db), 'parent_home')).toBe('/photos/family-study.webp');
	});
});
