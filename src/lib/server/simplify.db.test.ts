import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshDb, hasTestDb } from './testing/db.ts';
import { makeUser } from './testing/fixtures.ts';
import type { DB } from './db/types.ts';
import { attendee, homework, lesson, subject } from './db/app.schema.ts';
import { notification } from './db/app.schema.ts';
import { assessmentResult, checkin, familyLink } from './db/v3.schema.ts';
import type { Notify } from './notify-core.ts';
import { flagOn, setFlag, videoRoomOn } from './flags.ts';
import { forgetShared } from './cache.ts';
import { markMissingHomework } from './homework-status.ts';
import { giveHomework, handIn, markAnswer } from './people.ts';
import {
	createReport,
	deleteReport,
	ReportFail,
	sendReport,
	sentReport,
	sentReportsFor,
	updateReport
} from './reports.ts';
import { fromLocal } from '../tz.ts';

describe.skipIf(!hasTestDb)('Simpler lessons, homework and reports (real database)', () => {
	let db: DB;
	let close: () => Promise<void>;
	let tid: string;
	let other: string;
	let sid: string;
	let pid: string;
	beforeAll(async () => {
		({ db, close } = await freshDb());
		other = (await makeUser(db, 'tutor', 'Other Tutor')).id;
		tid = (await makeUser(db, 'tutor', 'Tutor One')).id;
		sid = (await makeUser(db, 'student', 'Tatenda Moyo')).id;
		pid = (await makeUser(db, 'parent', 'Mrs Moyo', null)).id;
		await db.insert(familyLink).values({
			parentId: pid,
			studentId: sid,
			guardian: true,
			shareHomework: true,
			shareProgress: true
		});
	});
	afterAll(async () => close?.());

	describe('the old Tutora video room switch', () => {
		it('is off by default and the owner can turn it on and off', async () => {
			forgetShared('flag:');
			expect(await videoRoomOn(db)).toBe(false);
			await setFlag(db, 'video_room', true);
			expect(await videoRoomOn(db)).toBe(true);
			await setFlag(db, 'video_room', false);
			expect(await flagOn(db, 'video_room')).toBe(false);
		});
	});

	describe('homework: late and missing', () => {
		const sent: { to: string; subject: string }[] = [];
		const notify: Notify = async (to, subject) => {
			sent.push({ to, subject });
		};
		it('marks overdue homework missing once, tells the child and family, never handed-in work', async () => {
			const now = fromLocal('2026-11-16', 10 * 60);
			const old = await giveHomework(db, tid, {
				userId: sid,
				title: 'Fractions',
				note: null,
				dueOn: '2026-11-14',
				dueTime: '18:00',
				fileKey: null,
				fileName: null
			});
			const recent = await giveHomework(db, tid, {
				userId: sid,
				title: 'Due last night',
				note: null,
				dueOn: '2026-11-15',
				dueTime: '20:00',
				fileKey: null,
				fileName: null
			});
			const done = await giveHomework(db, tid, {
				userId: sid,
				title: 'Handed in',
				note: null,
				dueOn: '2026-11-13',
				dueTime: '18:00',
				fileKey: null,
				fileName: null
			});
			await handIn(db, sid, done.id, { note: 'here', fileKey: null, fileName: null });
			expect(await markMissingHomework(db, notify, now)).toBe(1);
			const rows = await db.select().from(homework).where(eq(homework.userId, sid));
			const by = (id: number) => rows.find((r) => r.id === id)!;
			expect(by(old.id)).toMatchObject({ mark: 'missing', markAuto: true });
			expect(by(recent.id).mark).toBeNull();
			expect(by(done.id).mark).toBeNull();
			expect(sent.map((s) => s.to).sort()).toEqual([pid, sid].sort());
			// a second run tells nobody again
			expect(await markMissingHomework(db, notify, now)).toBe(0);
			// handing in after "missing" clears the automatic mark for the tutor to decide
			const a = await handIn(db, sid, old.id, { note: 'late work', fileKey: null, fileName: null });
			const [after] = await db.select().from(homework).where(eq(homework.id, old.id));
			expect(after.mark).toBeNull();
			// the tutor marks it late; another tutor cannot
			expect(await markAnswer(db, other, a!.id, { comment: null, mark: 'done' })).toBe(false);
			expect(await markAnswer(db, tid, a!.id, { comment: 'ok', mark: 'late' })).toBe(true);
			const [marked] = await db.select().from(homework).where(eq(homework.id, old.id));
			expect(marked).toMatchObject({ mark: 'late', markAuto: false });
		});
	});

	describe('reports', () => {
		it('builds figures from this tutor only, keeps drafts private, and the family sees it once sent', async () => {
			const [s] = await db.insert(subject).values({ tutorId: tid, name: 'Maths' }).returning();
			const mk = async (tutorId: string, day: string, attendance: 'completed' | 'absent') => {
				const [l] = await db
					.insert(lesson)
					.values({
						tutorId,
						subjectId: tutorId === tid ? s.id : null,
						kind: 'lesson',
						mode: 'online',
						startsAt: fromLocal(day, 16 * 60),
						endsAt: fromLocal(day, 17 * 60),
						capacity: 1
					})
					.returning();
				await db
					.insert(attendee)
					.values({ lessonId: l.id, userId: sid, priceCents: 0, attendance });
			};
			await mk(tid, '2026-10-05', 'completed');
			await mk(tid, '2026-10-12', 'absent');
			await mk(other, '2026-10-06', 'completed');
			await db.insert(assessmentResult).values([
				{
					studentId: sid,
					tutorId: tid,
					source: 'test',
					title: 'T1',
					subject: 'Maths',
					topic: 'Algebra',
					score: 8,
					maxScore: 10,
					takenOn: '2026-10-10'
				},
				{
					studentId: sid,
					tutorId: other,
					source: 'test',
					title: 'Other',
					subject: 'English',
					topic: 'Essay',
					score: 1,
					maxScore: 10,
					takenOn: '2026-10-10'
				}
			]);
			await db.insert(checkin).values([
				{ studentId: sid, mood: 'confident', createdAt: fromLocal('2026-10-07', 600) },
				{
					studentId: sid,
					mood: 'need_help',
					createdAt: fromLocal('2026-10-08', 600),
					sharedWithTutor: false
				}
			]);
			const stranger = (await makeUser(db, 'student', 'Stranger', other)).id;
			await expect(
				createReport(db, tid, stranger, { from: '2026-10-01', to: '2026-10-31' }, 'x')
			).rejects.toThrow(ReportFail);
			const r = await createReport(
				db,
				tid,
				sid,
				{ from: '2026-10-01', to: '2026-10-31' },
				'Good month',
				fromLocal('2026-11-16', 600)
			);
			expect(r.figures.lessons).toEqual({ booked: 2, attended: 1, missed: 1 });
			expect(r.figures.tests).toEqual([
				{ subject: 'Maths', chapter: 'Algebra', pct: 80, tests: 1 }
			]);
			expect(r.figures.testAvg).toBe(80);
			expect(r.figures.checkins).toEqual({ count: 1, days: 1 });
			expect(r.status).toBe('draft');
			// drafts are never shown to the family
			expect(await sentReportsFor(db, sid)).toHaveLength(0);
			expect(await sentReport(db, sid, r.id)).toBeNull();
			await expect(updateReport(db, other, r.id, 'hack')).rejects.toThrow('err_not_found');
			await updateReport(db, tid, r.id, 'Great month');
			await sendReport(db, tid, r.id);
			const seen = await sentReportsFor(db, sid);
			expect(seen).toHaveLength(1);
			expect(seen[0].note).toBe('Great month');
			const told = await db.select().from(notification).where(eq(notification.userId, pid));
			expect(told.some((n) => n.link?.includes('#reports'))).toBe(true);
			// a sent report cannot be deleted
			expect(await deleteReport(db, tid, r.id)).toBe(false);
		});
	});
});
