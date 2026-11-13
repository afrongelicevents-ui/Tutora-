import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { freshDb, hasTestDb } from './testing/db.ts';
import { makeUser } from './testing/fixtures.ts';
import type { DB } from './db/types.ts';
import { enrollment, profile } from './db/app.schema.ts';
import { familyLink } from './db/v3.schema.ts';
import {
	childConversations,
	conversations,
	sendMessage,
	thread,
	unreadByTutor
} from './messages.ts';
import { myTutors } from './student-tutors.ts';

describe.skipIf(!hasTestDb)('student ↔ tutor messages (real database)', () => {
	let db: DB;
	let close: () => Promise<void>;
	beforeAll(async () => {
		({ db, close } = await freshDb());
	});
	afterAll(async () => close?.());

	it('only enrolled pairs can write; parents of under-18s can read, nobody else', async () => {
		const tutor = await makeUser(db, 'tutor', 'Mrs Tutor');
		const other = await makeUser(db, 'tutor', 'Other Tutor');
		const kid = await makeUser(db, 'student', 'Kid Student', tutor.id);
		const adult = await makeUser(db, 'student', 'Adult Student', tutor.id);
		await db
			.update(profile)
			.set({ isUnder18: true, parentName: 'P', parentPhone: '1' })
			.where(eq(profile.userId, kid.id));
		await db.update(profile).set({ isUnder18: false }).where(eq(profile.userId, adult.id));
		const parent = await makeUser(db, 'parent', 'Parent');
		await db
			.insert(familyLink)
			.values({ parentId: parent.id, studentId: kid.id, guardian: true, status: 'active' });
		const strangerParent = await makeUser(db, 'parent', 'Stranger');

		const pair = { tutorId: tutor.id, studentId: kid.id };
		expect(await sendMessage(db, kid.id, pair, 'Hello, can we do fractions?')).toMatchObject({
			ok: true,
			toId: tutor.id
		});
		expect((await sendMessage(db, tutor.id, pair, 'Yes!')).ok).toBe(true);
		// not enrolled: no
		expect((await sendMessage(db, kid.id, { tutorId: other.id, studentId: kid.id }, 'hi')).ok).toBe(
			false
		);
		// a third person can't write into someone else's conversation
		expect((await sendMessage(db, other.id, pair, 'hi')).ok).toBe(false);
		// empty / too long
		expect((await sendMessage(db, kid.id, pair, '   ')).ok).toBe(false);
		expect((await sendMessage(db, kid.id, pair, 'x'.repeat(1001))).ok).toBe(false);

		// unread counts, then reading marks read
		expect((await unreadByTutor(db, kid.id)).get(tutor.id)).toBe(1);
		expect((await myTutors(db, kid.id))[0]).toMatchObject({ tutorId: tutor.id, unread: 1 });
		const seen = await thread(db, { id: kid.id, role: 'student' }, pair);
		expect(seen?.map((x) => x.body)).toEqual(['Hello, can we do fractions?', 'Yes!']);
		expect((await unreadByTutor(db, kid.id)).get(tutor.id)).toBeUndefined();
		expect((await conversations(db, tutor.id, 'tutor'))[0]).toMatchObject({
			otherId: kid.id,
			last: 'Yes!',
			lastFromMe: true
		});

		// parent of the under-18 can read; reading doesn't mark anything read
		await sendMessage(db, tutor.id, pair, 'See you Thursday');
		expect(await thread(db, { id: parent.id, role: 'parent' }, pair)).toHaveLength(3);
		expect((await unreadByTutor(db, kid.id)).get(tutor.id)).toBe(1);
		expect(await childConversations(db, parent.id, kid.id)).toHaveLength(1);
		// a different parent, another tutor or another student can't
		expect(await thread(db, { id: strangerParent.id, role: 'parent' }, pair)).toBeNull();
		expect(await childConversations(db, strangerParent.id, kid.id)).toBeNull();
		expect(await thread(db, { id: other.id, role: 'tutor' }, pair)).toBeNull();
		expect(await thread(db, { id: adult.id, role: 'student' }, pair)).toBeNull();

		// an adult student's messages stay private, even from a connected parent
		const apair = { tutorId: tutor.id, studentId: adult.id };
		await sendMessage(db, adult.id, apair, 'Hi');
		await db
			.insert(familyLink)
			.values({ parentId: parent.id, studentId: adult.id, guardian: false, status: 'active' });
		expect(await thread(db, { id: parent.id, role: 'parent' }, apair)).toBeNull();

		// tutors can't message parent accounts, even enrolled ones
		const par = await makeUser(db, 'parent', 'Enrolled Parent', tutor.id);
		expect(
			(await sendMessage(db, tutor.id, { tutorId: tutor.id, studentId: par.id }, 'hi')).ok
		).toBe(false);

		// a tutor who is no longer enrolled loses access; the student keeps the history
		await db
			.delete(enrollment)
			.where(and(eq(enrollment.tutorId, tutor.id), eq(enrollment.userId, kid.id)));
		expect(await thread(db, { id: tutor.id, role: 'tutor' }, pair)).toBeNull();
		expect(await thread(db, { id: kid.id, role: 'student' }, pair)).toHaveLength(3);
		expect((await sendMessage(db, kid.id, pair, 'hello?')).ok).toBe(false);
	});
});
