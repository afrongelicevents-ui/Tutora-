import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshDb, hasTestDb } from './testing/db.ts';
import { makeUser, MONDAY_8AM } from './testing/fixtures.ts';
import type { DB } from './db/types.ts';
import { profile } from './db/app.schema.ts';
import { createInvite, redeemInvite, removeLink } from './family.ts';
import {
	byToken,
	canRequest,
	details,
	endPartnership,
	forTeacher,
	giveConsent,
	inviteTeacher,
	logOf,
	memberPartnership,
	postMessage,
	requestPartnership,
	savePlan,
	saveReport,
	schoolPlusForChild,
	stopPartnership,
	teacherPartnership,
	teacherRespond,
	tutorDecide
} from './partnership.ts';

describe.skipIf(!hasTestDb)('School+: every status and who may see what', () => {
	let db: DB;
	let close: () => Promise<void>;
	let T: string;
	const now = MONDAY_8AM;

	beforeAll(async () => {
		({ db, close } = await freshDb());
		T = (await makeUser(db, 'tutor', 'Miss Doreen')).id;
	});
	afterAll(async () => close?.());

	async function family(name: string, tutorId: string | null = T) {
		const kid = await makeUser(db, 'student', name, tutorId);
		await db
			.update(profile)
			.set({ isUnder18: true, parentName: 'P', parentPhone: '+263770000000' })
			.where(eq(profile.userId, kid.id));
		const parent = await makeUser(db, 'parent', `${name}'s guardian`, null);
		const { code } = await createInvite(db, kid.id, now);
		await redeemInvite(db, code, parent.id, { guardianClaim: true }, now);
		return { kid, parent };
	}
	const ask = (parentId: string, studentId: string, extra = {}) =>
		requestPartnership(db, parentId, {
			studentId,
			tutorId: T,
			subject: 'Maths',
			schoolName: 'Test High',
			teacherName: 'Mr Teacher',
			...extra
		});

	it('the happy path: requested → tutor accepted → invited → teacher accepted → consent → active → ended', async () => {
		const { kid, parent } = await family('Rudo');
		expect((await canRequest(db, parent.id, kid.id)).ok).toBe(true);
		const p = await ask(parent.id, kid.id);
		expect(p.status).toBe('requested');
		// only one open partnership per child
		expect((await canRequest(db, parent.id, kid.id)).reason).toBe('open');

		// another tutor can't act; the right one agrees, then invites
		const other = await makeUser(db, 'tutor', 'Not their tutor', null);
		await expect(tutorDecide(db, other.id, p.id, true)).rejects.toThrow();
		expect((await tutorDecide(db, T, p.id, true)).status).toBe('tutor_accepted');
		await expect(tutorDecide(db, T, p.id, true)).rejects.toThrow(); // not twice
		const first = await inviteTeacher(db, T, p.id);
		const { token, p: invited } = await inviteTeacher(db, T, p.id); // a new link
		expect(invited.status).toBe('teacher_invited');
		expect(await byToken(db, first.token)).toBeNull(); // the older link stopped working
		expect(await byToken(db, token)).not.toBeNull();

		// only a schoolteacher account can accept
		await expect(teacherRespond(db, token, parent.id, true)).rejects.toThrow(
			'sp3_err_teacher_account'
		);
		const teacher = await makeUser(db, 'schoolteacher', 'Mr T. Real');
		expect((await teacherRespond(db, token, teacher.id, true)).status).toBe('teacher_accepted');
		expect(await byToken(db, token)).toBeNull(); // used once

		// no messages, plan or notes before the guardian consents
		const asTeacher = { role: 'teacher' as const, userId: teacher.id };
		await expect(postMessage(db, asTeacher, p.id, 'hello')).rejects.toThrow();
		await expect(
			giveConsent(db, parent.id, p.id, { consentName: 'G', consent: true })
		).rejects.toThrow('sp3_err_consent');
		// someone else's name is refused; the parent's own name (any capitals/spaces) is fine
		await expect(
			giveConsent(db, parent.id, p.id, { consentName: 'Somebody Else', consent: true })
		).rejects.toThrow('sp3_err_consent_name');
		const active = await giveConsent(db, parent.id, p.id, {
			consentName: "  rudo's  GUARDIAN ",
			consent: true
		});
		expect(active.status).toBe('active');
		// the consent names the teacher who really accepted
		expect(active.consentText).toContain('Mr T. Real');
		expect(active.activeAt).toBeTruthy();

		await postMessage(db, asTeacher, p.id, 'We start fractions next week.');
		await postMessage(db, { role: 'tutor', userId: T }, p.id, 'Thanks, I will match it.');
		await expect(
			postMessage(db, { role: 'parent', userId: parent.id }, p.id, 'x')
		).rejects.toThrow();
		await savePlan(db, asTeacher, p.id, { goals: 'Pass the test', topics: 'Fractions' });
		await saveReport(db, asTeacher, p.id, 'Good effort this month.', now);
		await saveReport(db, asTeacher, p.id, 'Very good effort this month.', now); // replaces

		const d = await details(db, active);
		expect(d.plan?.topics).toBe('Fractions');
		expect(d.reports).toHaveLength(1);
		expect(d.reports[0].body).toContain('Very good');
		expect(d.messages).toBe(2);
		expect(d.steps.every((s) => s.state === 'done')).toBe(true);
		expect(d.teacher).toBe('Mr T. Real');

		// the parent's view per child
		const view = await schoolPlusForChild(db, parent.id, kid.id);
		expect(view?.current?.p.id).toBe(p.id);

		// the teacher ends it: no more messages, and the log has every step
		const ended = await endPartnership(db, asTeacher, p.id);
		expect(ended.status).toBe('ended');
		await expect(postMessage(db, asTeacher, p.id, 'more')).rejects.toThrow();
		const log = (await logOf(db, p.id)).map((l) => l.body);
		expect(log[0]).toContain('Asked');
		expect(log.at(-1)).toContain('teacher ended');
		// a new request is possible again afterwards
		expect((await canRequest(db, parent.id, kid.id)).ok).toBe(true);
	});

	it('declines: by the tutor, and by the teacher', async () => {
		const a = await family('Tino');
		const p1 = await ask(a.parent.id, a.kid.id);
		const d1 = await tutorDecide(db, T, p1.id, false);
		expect([d1.status, d1.declinedBy]).toEqual(['declined', 'tutor']);
		await expect(inviteTeacher(db, T, p1.id)).rejects.toThrow();

		const p2 = await ask(a.parent.id, a.kid.id);
		await tutorDecide(db, T, p2.id, true);
		const { token } = await inviteTeacher(db, T, p2.id);
		const teacher = await makeUser(db, 'schoolteacher', 'Mrs No');
		const d2 = await teacherRespond(db, token, teacher.id, false);
		expect([d2.status, d2.declinedBy]).toEqual(['declined', 'teacher']);
		expect(await byToken(db, token)).toBeNull();
	});

	it('withdrawn before it starts, ended after; the tutor can end it after agreeing', async () => {
		const a = await family('Nyari');
		const p = await ask(a.parent.id, a.kid.id);
		await tutorDecide(db, T, p.id, true);
		const { token } = await inviteTeacher(db, T, p.id);
		expect((await stopPartnership(db, a.parent.id, p.id)).status).toBe('withdrawn');
		expect(await byToken(db, token)).toBeNull(); // the invite stops working

		const p2 = await ask(a.parent.id, a.kid.id);
		await tutorDecide(db, T, p2.id, true);
		expect((await endPartnership(db, { role: 'tutor', userId: T }, p2.id)).status).toBe('ended');
	});

	it('find a tutor first: no request without a tutor on Tutora; not for adults', async () => {
		const { kid, parent } = await family('No Tutor Yet', null);
		const c = await canRequest(db, parent.id, kid.id);
		expect([c.ok, c.reason]).toEqual([false, 'no_tutor']);
		await expect(ask(parent.id, kid.id)).rejects.toThrow('sp3_err_no_tutor');

		const adult = await makeUser(db, 'student', 'Grown Up', T);
		const dad = await makeUser(db, 'parent', 'Dad', null);
		const { code } = await createInvite(db, adult.id, now);
		await redeemInvite(db, code, dad.id, { guardianClaim: false }, now);
		await expect(ask(dad.id, adult.id)).rejects.toThrow('sp3_err_adult');
	});

	it('a teacher sees only the partnerships they accepted; other parents see nothing', async () => {
		const a = await family('Kuda');
		const b = await family('Chiedza');
		const pa = await ask(a.parent.id, a.kid.id);
		const pb = await ask(b.parent.id, b.kid.id);
		for (const p of [pa, pb]) await tutorDecide(db, T, p.id, true);
		const ta = await makeUser(db, 'schoolteacher', 'Teacher A');
		const tb = await makeUser(db, 'schoolteacher', 'Teacher B');
		await teacherRespond(db, (await inviteTeacher(db, T, pa.id)).token, ta.id, true);
		await teacherRespond(db, (await inviteTeacher(db, T, pb.id)).token, tb.id, true);

		expect((await forTeacher(db, ta.id)).map((r) => r.p.id)).toEqual([pa.id]);
		expect(await teacherPartnership(db, ta.id, pb.id)).toBeNull();
		expect(await memberPartnership(db, { role: 'teacher', userId: ta.id }, pb.id)).toBeNull();
		expect(await memberPartnership(db, { role: 'parent', userId: a.parent.id }, pb.id)).toBeNull();
		await expect(endPartnership(db, { role: 'teacher', userId: ta.id }, pb.id)).rejects.toThrow();
		await expect(stopPartnership(db, a.parent.id, pb.id)).rejects.toThrow();
		expect(await schoolPlusForChild(db, a.parent.id, b.kid.id)).toBeNull();
	});

	it('ends when the guardian is no longer connected', async () => {
		const a = await family('Farai');
		const p = await ask(a.parent.id, a.kid.id);
		await tutorDecide(db, T, p.id, true);
		const { token } = await inviteTeacher(db, T, p.id);
		await removeLink(db, { role: 'parent', id: a.parent.id }, a.kid.id, a.parent.id);
		expect(await byToken(db, token)).toBeNull();
	});
});
