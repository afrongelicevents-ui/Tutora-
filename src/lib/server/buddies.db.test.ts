import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { freshDb, hasTestDb } from './testing/db.ts';
import { makeUser, MONDAY_8AM } from './testing/fixtures.ts';
import type { DB } from './db/types.ts';
import { familyLink } from './db/v3.schema.ts';
import { profile } from './db/app.schema.ts';
import { eq } from 'drizzle-orm';
import {
	ageOn,
	blockStudent,
	buddyView,
	canSeePhoto,
	connectByCode,
	DISPLAY_NAME,
	listBuddies,
	moderate,
	moderationQueue,
	myCode,
	newCode,
	ownProfile,
	parentBuddyList,
	parentDecide,
	removeBuddy,
	reportStudent,
	saveCard,
	sendPreset,
	setPhoto
} from './buddies.ts';
import * as buddies from './buddies.ts';

const now = MONDAY_8AM; // 2026-11-16
const card = (over: Partial<Parameters<typeof saveCard>[2]> = {}) => ({
	displayName: 'Amina D.',
	bio: '',
	grade: 'Form 2',
	school: 'Avondale High',
	subjects: ['Mathematics', 'English'],
	favouriteSubject: 'Mathematics',
	goals: 'Pass my end-of-term maths test',
	birthDate: '2012-03-04',
	...over
});

describe('profile rules (no database)', () => {
	it('age comes from the birthday; display names are first name + initial', () => {
		expect(ageOn('2012-11-16', now)).toBe(14);
		expect(ageOn('2012-11-17', now)).toBe(13);
		expect(DISPLAY_NAME.test('Amina D.')).toBe(true);
		expect(DISPLAY_NAME.test('Amina')).toBe(true);
		expect(DISPLAY_NAME.test('Amina Dube')).toBe(false);
		expect(DISPLAY_NAME.test('amina@x.com')).toBe(false);
	});
	it('there is no way to search or list students', () => {
		const names = Object.keys(buddies).join(' ').toLowerCase();
		expect(names).not.toMatch(/search|suggest|find|maybeknow|allstudents/);
	});
});

describe.skipIf(!hasTestDb)('Study Buddies permissions (real database)', () => {
	let db: DB;
	let close: () => Promise<void>;
	const student = async (name: string, birth: string | null, under18 = true) => {
		const s = await makeUser(db, 'student', name);
		await db
			.update(profile)
			.set({ isUnder18: under18, parentName: 'P', parentPhone: '1' })
			.where(eq(profile.userId, s.id));
		if (birth)
			expect(
				(
					await saveCard(
						db,
						s.id,
						card({
							displayName: `${name.split(' ')[0]} ${name.split(' ')[1][0]}.`,
							birthDate: birth
						}),
						now
					)
				).ok
			).toBe(true);
		return s;
	};
	const parentOf = async (childId: string) => {
		const p = await makeUser(db, 'parent', 'Parent');
		await db
			.insert(familyLink)
			.values({ parentId: p.id, studentId: childId, guardian: true, status: 'active' });
		return p;
	};

	beforeAll(async () => {
		({ db, close } = await freshDb());
		await makeUser(db, 'tutor', 'Tutor');
	});
	afterAll(async () => close?.());

	it('teens connect only with a one-time code; buddies see the whitelist only', async () => {
		const a = await student('Amina Dube', '2012-03-04'); // 14
		const b = await student('Tino Moyo', '2011-06-01'); // 15
		const pa = await parentOf(a.id);
		await saveCard(db, a.id, card({ bio: 'I love maths' }), now);
		const { code } = await myCode(db, a.id, now);

		// not buddies yet: nothing visible, photo hidden
		expect(await buddyView(db, b.id, a.id, now)).toBeNull();
		await setPhoto(db, a.id, 'student-photos/x.webp');
		expect(await canSeePhoto(db, { id: b.id, role: 'student' }, a.id)).toBe(false);

		const r = await connectByCode(db, b.id, code, { me: 'Tino M.', other: 'Amina D.' }, now);
		expect(r).toMatchObject({ ok: true, status: 'active' });
		// a teen's parent is told (and can remove)
		if (r.ok)
			expect(r.notices.some((n) => n.userId === pa.id && n.key === 'bn_added_parent')).toBe(true);
		// the code worked once
		const again = await connectByCode(
			db,
			(await student('Rudo Chi', '2012-01-01')).id,
			code,
			{ me: '' },
			now
		);
		expect(again).toEqual({ ok: false, error: 'buddy_code_bad' });

		const v = await buddyView(db, b.id, a.id, now);
		expect(v).not.toBeNull();
		expect(Object.keys(v!).sort()).toEqual(
			['badges', 'bio', 'displayName', 'grade', 'id', 'photoVersion', 'streak', 'subjects'].sort()
		);
		const flat = JSON.stringify(v);
		for (const secret of [
			'Avondale',
			'2012-03-04',
			'Pass my end-of-term',
			'@example.com',
			'Amina Dube'
		])
			expect(flat).not.toContain(secret);
		// bio and photo stay hidden until the owner checks them
		expect(v!.bio).toBeNull();
		expect(v!.photoVersion).toBe(0);
		expect(await canSeePhoto(db, { id: b.id, role: 'student' }, a.id)).toBe(false);
		await moderate(db, a.id, 'bio', true);
		await moderate(db, a.id, 'photo', true);
		const v2 = await buddyView(db, b.id, a.id, now);
		expect(v2!.bio).toBe('I love maths');
		expect(v2!.photoVersion).toBeGreaterThan(0);
		expect(await canSeePhoto(db, { id: b.id, role: 'student' }, a.id)).toBe(true);
		// a stranger and a tutor can't see the photo; the parent can
		const stranger = await student('Zed Zulu', '2012-02-02');
		expect(await canSeePhoto(db, { id: stranger.id, role: 'student' }, a.id)).toBe(false);
		expect(await canSeePhoto(db, { id: 'x', role: 'tutor' }, a.id)).toBe(false);
		expect(await canSeePhoto(db, { id: pa.id, role: 'parent' }, a.id)).toBe(true);
		expect(await buddyView(db, stranger.id, a.id, now)).toBeNull();

		// the owner sees the private fields only on the student's own profile
		const own = await ownProfile(db, a.id, now);
		expect(own.school).toBe('Avondale High');
		expect(own.age).toBe(14);

		// preset messages only
		expect((await sendPreset(db, b.id, a.id, 'good_luck', now)).ok).toBe(true);
		expect((await sendPreset(db, b.id, a.id, 'hi, what is your address?', now)).ok).toBe(false);
		expect((await sendPreset(db, stranger.id, a.id, 'good_luck', now)).ok).toBe(false);

		// report hides the bio again and reaches the owner's queue
		expect(await reportStudent(db, a.id, b.id, 'behaviour', 'rude')).toBe(true);
		expect(await reportStudent(db, b.id, a.id, 'bio', '')).toBe(true);
		expect((await buddyView(db, b.id, a.id, now))!.bio).toBeNull();
		const q = await moderationQueue(db);
		expect(q.reports.length).toBe(2);
		expect(q.cards.some((c) => c.userId === a.id && c.bioStatus === 'pending')).toBe(true);
		// a stranger can't report someone they never connected with
		expect(await reportStudent(db, stranger.id, a.id, 'photo', '')).toBe(false);

		// parent sees the child's buddy list and can remove the buddy
		const list = await parentBuddyList(db, pa.id, a.id);
		expect(list).toHaveLength(1);
		expect(await parentBuddyList(db, pa.id, b.id)).toBeNull();
		expect(await removeBuddy(db, pa.id, list![0].linkId)).toBe(true);
		expect(await buddyView(db, b.id, a.id, now)).toBeNull();
	});

	it('under 13: each child needs a parent, and the parent must approve', async () => {
		const kid = await student('Kuda Banda', '2016-05-05'); // 10
		const teen = await student('Nyasha Phiri', '2013-01-01'); // 13
		const { code } = await myCode(db, teen.id, now);
		// no parent connected yet: can't add buddies
		expect(await connectByCode(db, kid.id, code, { me: '' }, now)).toEqual({
			ok: false,
			error: 'buddy_need_parent'
		});
		const pk = await parentOf(kid.id);
		const otherParent = await makeUser(db, 'parent', 'Someone');
		const r = await connectByCode(db, kid.id, code, { me: 'Kuda B.', other: 'Nyasha P.' }, now);
		expect(r).toMatchObject({ ok: true, status: 'pending' });
		if (r.ok)
			expect(r.notices.some((n) => n.userId === pk.id && n.key === 'bn_request_parent')).toBe(true);
		// not visible to each other until approved
		expect(await buddyView(db, teen.id, kid.id, now)).toBeNull();
		const link = (await parentBuddyList(db, pk.id, kid.id))![0];
		expect(link.needsMe).toBe(true);
		// a different parent cannot approve
		expect((await parentDecide(db, otherParent.id, link.linkId, true, now)).ok).toBe(false);
		const ok = await parentDecide(db, pk.id, link.linkId, true, now);
		expect(ok).toMatchObject({ ok: true, activated: true });
		expect(await buddyView(db, teen.id, kid.id, now)).not.toBeNull();
	});

	it('children never connect with adults; blocking stops everything', async () => {
		const adult = await student('Grace Zulu', '1990-01-01', false);
		const child = await student('Rudo Banda', '2011-01-01');
		const c1 = await myCode(db, adult.id, now);
		expect(await connectByCode(db, child.id, c1.code, { me: '' }, now)).toEqual({
			ok: false,
			error: 'buddy_age_mismatch'
		});
		// unknown age on a child account counts as under 13
		const unknown = await student('Tafadzwa Moyo', null);
		const c2 = await newCode(db, child.id, now);
		expect(await connectByCode(db, unknown.id, c2.code, { me: '' }, now)).toEqual({
			ok: false,
			error: 'buddy_need_parent'
		});
		// block
		const friend = await student('Chipo Dube', '2011-02-02');
		const c3 = await newCode(db, friend.id, now);
		expect((await connectByCode(db, child.id, c3.code, { me: '' }, now)).ok).toBe(true);
		expect(await blockStudent(db, friend.id, child.id)).toBe(true);
		expect(await buddyView(db, child.id, friend.id, now)).toBeNull();
		expect((await sendPreset(db, child.id, friend.id, 'good_luck', now)).ok).toBe(false);
		const c4 = await newCode(db, friend.id, now);
		expect(await connectByCode(db, child.id, c4.code, { me: '' }, now)).toEqual({
			ok: false,
			error: 'buddy_code_bad'
		});
		expect((await listBuddies(db, child.id, now)).active).toHaveLength(0);
	});

	it('typed birthdays never move an account across the child/adult line', async () => {
		// a child account typing an adult birthday is treated as under 13 (parent approval)
		const kid = await student('Lindiwe Moyo', '1995-01-01');
		expect(await buddies.ageBand(db, kid.id, now)).toBe('under13');
		// an adult account typing a teen birthday stays an adult (can't reach children)
		const grown = await student('Peter Adult', '2011-01-01', false);
		expect(await buddies.ageBand(db, grown.id, now)).toBe('adult');
		const teen = await student('Teen Real', '2011-01-01');
		const c = await myCode(db, teen.id, now);
		expect(await connectByCode(db, grown.id, c.code, { me: '' }, now)).toEqual({
			ok: false,
			error: 'buddy_age_mismatch'
		});
	});

	it('a birthday cannot be changed once saved (no "ageing up")', async () => {
		const s = await student('Vimbai Hove', '2015-01-01');
		await saveCard(db, s.id, card({ displayName: 'Vimbai H.', birthDate: '2000-01-01' }), now);
		expect((await ownProfile(db, s.id, now)).age).toBe(11);
	});
});
