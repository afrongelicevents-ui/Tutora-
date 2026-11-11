import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshDb, hasTestDb } from './testing/db.ts';
import { makeUser, MONDAY_8AM, zw } from './testing/fixtures.ts';
import type { DB } from './db/types.ts';
import {
	addResult,
	addSubject,
	getSettings,
	paymentDetails,
	publicSite,
	replaceAvailability,
	updateSettings
} from './settings.ts';
import { attendee, lesson, roomParticipant } from './db/app.schema.ts';
import {
	allReviews,
	canReview,
	displayNameFor,
	getStudent,
	giveFeedback,
	giveHomework,
	handIn,
	homeworkForUser,
	listStudents,
	postReview,
	setReviewHidden
} from './people.ts';
import { admit, enter, MAX_SIGNAL_BYTES, poll, roomAccess, sendSignal } from './room.ts';
import { sendDueReminders } from './reminders.ts';
import { parseAvailability } from '../validation/settings.ts';

describe.skipIf(!hasTestDb)(
	'public site, homework, reviews, lesson room, reminders (real database)',
	() => {
		let db: DB;
		let close: () => Promise<void>;
		beforeAll(async () => ({ db, close } = await freshDb()));
		afterAll(async () => close?.());

		async function lessonFor(
			userIds: string[],
			start: Date,
			mode: 'online' | 'in_person' = 'online'
		) {
			const [l] = await db
				.insert(lesson)
				.values({
					kind: 'lesson',
					mode,
					startsAt: start,
					endsAt: new Date(start.getTime() + 3_600_000),
					capacity: 4
				})
				.returning();
			for (const u of userIds)
				await db.insert(attendee).values({ lessonId: l.id, userId: u, priceCents: 0 });
			return l;
		}

		describe('public site shows only what the tutor filled in', () => {
			it('starts empty: no name, contacts, subjects or prices', async () => {
				const s = await getSettings(db);
				expect(s.tutorName).toBeNull();
				expect(s.whatsappNumber).toBeNull();
				const site = await publicSite(db);
				expect(site.has).toEqual({
					about: false,
					subjects: false,
					results: false,
					reviews: false,
					anything: false
				});
				expect(site.whatsapp).toBeNull();
			});

			it('"Ask for price" hides every price; results need permission', async () => {
				await updateSettings(db, {
					tutorName: 'Mr T',
					bio: 'Hi',
					defaultPriceCents: 800,
					showPrices: false
				});
				await addSubject(db, { name: 'Maths', levels: 'O Level', price: 1000 });
				await addResult(db, { value: '94%', label: 'pass rate' });
				let site = await publicSite(db);
				expect(site.has.about && site.has.subjects && site.has.anything).toBe(true);
				expect(site.subjects[0].priceCents).toBeNull();
				expect(site.has.results).toBe(false);
				await updateSettings(db, { showPrices: true, resultsConsent: true });
				site = await publicSite(db);
				expect(site.subjects[0].priceCents).toBe(1000);
				expect(site.results).toEqual([{ value: '94%', label: 'pass rate' }]);
			});

			it('never includes payment details', async () => {
				await updateSettings(db, { ecocashNumber: '0770000000', bankAccountNumber: '123' });
				const site = await publicSite(db);
				expect(JSON.stringify(site)).not.toContain('0770000000');
				expect(paymentDetails(await getSettings(db)).ecocash?.number).toBe('0770000000');
			});

			it('weekly free times are validated', () => {
				expect(
					parseAvailability({
						on1: 'on',
						from1: '15:00',
						to1: '18:00',
						on2: 'on',
						from2: '18:00',
						to2: '15:00'
					})
				).toEqual({
					ok: false,
					errors: { day2: 'err_times' }
				});
				expect(parseAvailability({ on6: 'on', from6: '08:00', to6: '12:00', from1: 'x' })).toEqual({
					ok: true,
					rows: [{ weekday: 6, startMinute: 480, endMinute: 720 }]
				});
			});

			it('free times are replaced as a whole', async () => {
				await replaceAvailability(db, [{ weekday: 1, startMinute: 900, endMinute: 1080 }]);
				await replaceAvailability(db, [{ weekday: 2, startMinute: 900, endMinute: 1080 }]);
				const { listAvailability } = await import('./settings.ts');
				expect((await listAvailability(db)).map((r) => r.weekday)).toEqual([2]);
			});
		});

		describe('students list (tutor)', () => {
			it('lists only students and parents, with search', async () => {
				await makeUser(db, 'student', 'Tendai Moyo');
				await makeUser(db, 'parent', 'Mai Dube');
				const tutor = await makeUser(db, 'tutor', 'The Tutor');
				const all = await listStudents(db);
				expect(all.map((s) => s.name)).toEqual(expect.arrayContaining(['Tendai Moyo', 'Mai Dube']));
				expect(all.some((s) => s.id === tutor.id)).toBe(false);
				expect((await listStudents(db, 'tend')).map((s) => s.name)).toEqual(['Tendai Moyo']);
				expect(await listStudents(db, '%')).toEqual([]); // wildcards are treated as text
				expect(await getStudent(db, tutor.id)).toBeNull();
			});
		});

		describe('homework', () => {
			it('students hand in only their own homework; tutor gives feedback', async () => {
				const a = await makeUser(db, 'student');
				const b = await makeUser(db, 'student');
				const hw = await giveHomework(db, {
					userId: a.id,
					title: 'Ex 4B',
					note: null,
					dueOn: '2026-11-20',
					fileKey: null,
					fileName: null
				});
				expect(
					await handIn(db, b.id, hw.id, { note: 'not mine', fileKey: null, fileName: null })
				).toBeNull();
				const ans = await handIn(db, a.id, hw.id, {
					note: 'done',
					fileKey: 'answers/x.jpg',
					fileName: 'x.jpg'
				});
				expect(ans).not.toBeNull();
				await giveFeedback(db, ans!.id, 'Good work');
				const list = await homeworkForUser(db, a.id);
				expect(list[0].answers[0].feedback).toBe('Good work');
				expect(await homeworkForUser(db, b.id)).toEqual([]);
			});
		});

		describe('reviews', () => {
			it('only after a past lesson; first name only; tutor can hide but not edit', async () => {
				const u = await makeUser(db, 'student', 'Rudo Chipo Moyo');
				expect(await canReview(db, u.id, MONDAY_8AM)).toBe(false);
				expect(await postReview(db, u.id, u.name, 5, 'Great', MONDAY_8AM)).toBeNull();
				await lessonFor([u.id], zw(-2, '15:00'));
				const r = await postReview(db, u.id, u.name, 5, 'Great teacher', MONDAY_8AM);
				expect(r!.displayName).toBe('Rudo');
				await setReviewHidden(db, r!.id, true);
				expect((await publicSite(db)).reviews.some((x) => x.text === 'Great teacher')).toBe(false);
				// re-posting does not un-hide a hidden review
				await postReview(db, u.id, u.name, 4, 'Changed my words', MONDAY_8AM);
				const mine = (await allReviews(db)).find((x) => x.userId === u.id)!;
				expect(mine.hidden).toBe(true);
				expect(displayNameFor('  ')).toBe('Student');
			});
		});

		describe('lesson room', () => {
			it('only the tutor and booked students, only online, only around lesson time', async () => {
				const tutor = await makeUser(db, 'tutor');
				const s1 = await makeUser(db, 'student');
				const s2 = await makeUser(db, 'student');
				const stranger = await makeUser(db, 'student');
				const start = zw(0, '15:00');
				const l = await lessonFor([s1.id, s2.id], start);
				const at = new Date(start.getTime() - 10 * 60_000);
				expect((await roomAccess(db, tutor, l.id, at))?.role).toBe('tutor');
				expect((await roomAccess(db, s1, l.id, at))?.role).toBe('student');
				expect(await roomAccess(db, stranger, l.id, at)).toBeNull();
				expect(
					await roomAccess(db, s1, l.id, new Date(start.getTime() - 2 * 3_600_000))
				).toBeNull(); // too early
				expect(
					await roomAccess(db, s1, l.id, new Date(start.getTime() + 4 * 3_600_000))
				).toBeNull(); // too late
				const inPerson = await lessonFor([s1.id], zw(1, '15:00'), 'in_person');
				expect(
					await roomAccess(db, s1, inPerson.id, new Date(zw(1, '15:00').getTime() - 60_000))
				).toBeNull();
			});

			it('students wait until the tutor lets them in; messages only between admitted people', async () => {
				const tutor = await makeUser(db, 'tutor');
				const s = await makeUser(db, 'student');
				const start = zw(0, '17:00');
				const l = await lessonFor([s.id], start);
				const at = new Date(start.getTime() - 5 * 60_000);
				await enter(db, (await roomAccess(db, tutor, l.id, at))!, tutor.id, at);
				await enter(db, (await roomAccess(db, s, l.id, at))!, s.id, at);
				let p = await poll(db, l.id, s.id, 0, at);
				expect(p.admitted).toBe(false);
				// a waiting student sees nobody; the tutor sees them waiting
				expect(p.people).toEqual([]);
				const tp = await poll(db, l.id, tutor.id, 0, at);
				expect(tp.people.find((x) => x.userId === s.id)?.status).toBe('waiting');
				expect(await sendSignal(db, l.id, tutor.id, s.id, 'offer', '{}')).toBe(false);
				await admit(db, l.id, s.id);
				expect(await sendSignal(db, l.id, tutor.id, s.id, 'offer', '{"sdp":"x"}')).toBe(true);
				expect(
					await sendSignal(db, l.id, tutor.id, s.id, 'ice', 'x'.repeat(MAX_SIGNAL_BYTES + 1))
				).toBe(false);
				p = await poll(db, l.id, s.id, 0, at);
				expect(p.admitted).toBe(true);
				expect(p.signals.map((x) => x.kind)).toEqual(['offer']);
				// already seen messages are not sent again
				expect((await poll(db, l.id, s.id, p.signals[0].id, at)).signals).toEqual([]);
				// the tutor does not receive messages meant for the student
				expect((await poll(db, l.id, tutor.id, 0, at)).signals).toEqual([]);
				// reconnecting keeps the student admitted
				await enter(db, (await roomAccess(db, s, l.id, at))!, s.id, at);
				const [row] = await db
					.select()
					.from(roomParticipant)
					.where(eq(roomParticipant.userId, s.id));
				expect(row.status).toBe('admitted');
			});
		});

		describe('reminders', () => {
			it('emails 24 h and 1 h before, once each', async () => {
				const u = await makeUser(db, 'student');
				const start = zw(3, '15:00');
				await lessonFor([u.id], start);
				const sent: string[] = [];
				const mail = async (m: { to: string; subject: string }) => {
					sent.push(m.subject);
				};
				const dayBefore = new Date(start.getTime() - 23 * 3_600_000);
				await sendDueReminders(db, mail, 'https://example.test', dayBefore);
				await sendDueReminders(db, mail, 'https://example.test', dayBefore);
				expect(sent.filter((s) => s.includes('tomorrow'))).toHaveLength(1);
				await sendDueReminders(
					db,
					mail,
					'https://example.test',
					new Date(start.getTime() - 50 * 60_000)
				);
				expect(sent.filter((s) => s.includes('in 1 hour'))).toHaveLength(1);
			});
		});
	}
);
