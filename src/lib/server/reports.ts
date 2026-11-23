/**
 * Reports stored in Tutora: a tutor writes one about a student for a period (a month, or
 * dates they pick). Tutora fills in the figures from that tutor's own lessons, homework and
 * tests with this student, plus how often the student checked in (only check-ins the student
 * shares with tutors; never their words or feelings). The tutor adds a short note and sends
 * it; the family who may see progress then finds it on the child's page with a PDF.
 *
 * Every figure is scoped to the reporting tutor (another tutor's lessons or tests are never
 * shown), and a tutor can only report on their own students.
 */
import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { attendee, homework, lesson, tutorProfile } from './db/app.schema.ts';
import { user } from './db/auth.schema.ts';
import { assessmentResult, checkin } from './db/v3.schema.ts';
import { studentReport, type ReportFigures } from './db/report.schema.ts';
import { isEnrolled } from './people.ts';
import { parentsWhoSee } from './family.ts';
import { notifyUser } from './notify.ts';
import { firstName } from './study.ts';
import { tutorNameOf } from './events.ts';
import { fromLocal, isIsoDate, localDate } from '../tz.ts';
import { m } from '../paraglide/messages.js';

export class ReportFail extends Error {
	constructor(public code: string) {
		super(code);
	}
}

export const MAX_NOTE = 1500;
/** a report covers at most about a school term */
export const MAX_DAYS = 120;

/** Check and order the period ("YYYY-MM-DD" both, inclusive). */
export function cleanPeriod(from: string, to: string): { from: string; to: string } {
	if (!isIsoDate(from) || !isIsoDate(to)) throw new ReportFail('rp_err_dates');
	const [a, b] = from <= to ? [from, to] : [to, from];
	const days = (fromLocal(b).getTime() - fromLocal(a).getTime()) / 86_400_000;
	if (days > MAX_DAYS) throw new ReportFail('rp_err_too_long');
	return { from: a, to: b };
}

/** The last full calendar month before `now` (Zimbabwe time), the default report period. */
export function lastMonth(now = new Date()): { from: string; to: string } {
	const today = localDate(now);
	const [y, mo] = today.split('-').map(Number);
	const py = mo === 1 ? y - 1 : y;
	const pm = mo === 1 ? 12 : mo - 1;
	const last = new Date(Date.UTC(py, pm, 0)).getUTCDate();
	const p = (n: number) => String(n).padStart(2, '0');
	return { from: `${py}-${p(pm)}-01`, to: `${py}-${p(pm)}-${p(last)}` };
}

/** Pure: homework rows → counts (a mark wins; otherwise handed in = done, else waiting). */
export function countHomework(
	rows: { mark: string | null; handedIn: boolean; overdue: boolean }[]
): ReportFigures['homework'] {
	const c = { set: rows.length, done: 0, late: 0, missing: 0, waiting: 0 };
	for (const r of rows) {
		if (r.mark === 'done') c.done++;
		else if (r.mark === 'late') c.late++;
		else if (r.mark === 'missing') c.missing++;
		else if (r.handedIn) c.done++;
		else if (r.overdue) c.missing++;
		else c.waiting++;
	}
	return c;
}

/** Build the figures for one student, from this tutor's records only. */
export async function buildFigures(
	db: DB,
	tutorId: string,
	studentId: string,
	from: string,
	to: string,
	now = new Date()
): Promise<ReportFigures> {
	const start = fromLocal(from);
	const end = fromLocal(to, 24 * 60);
	const [lessons, hw, checks, results] = await Promise.all([
		db
			.select({ attendance: attendee.attendance, endsAt: lesson.endsAt })
			.from(attendee)
			.innerJoin(lesson, eq(lesson.id, attendee.lessonId))
			.where(
				and(
					eq(attendee.userId, studentId),
					eq(attendee.status, 'booked'),
					eq(lesson.tutorId, tutorId),
					sql`${lesson.status} <> 'cancelled'`,
					gte(lesson.startsAt, start),
					lte(lesson.startsAt, end)
				)
			),
		db
			.select({
				mark: homework.mark,
				dueOn: homework.dueOn,
				handedIn: sql<boolean>`exists (select 1 from homework_answer a where a.homework_id = "homework"."id")`
			})
			.from(homework)
			.where(
				and(
					eq(homework.userId, studentId),
					eq(homework.tutorId, tutorId),
					gte(homework.createdAt, start),
					lte(homework.createdAt, end)
				)
			),
		db
			.select({
				n: sql<number>`count(*)::int`,
				days: sql<number>`count(distinct (${checkin.createdAt} at time zone 'Africa/Harare')::date)::int`
			})
			.from(checkin)
			.where(
				and(
					eq(checkin.studentId, studentId),
					eq(checkin.sharedWithTutor, true),
					eq(checkin.kind, 'start'),
					gte(checkin.createdAt, start),
					lte(checkin.createdAt, end)
				)
			),
		db
			.select({
				subject: assessmentResult.subject,
				topic: assessmentResult.topic,
				score: assessmentResult.score,
				maxScore: assessmentResult.maxScore
			})
			.from(assessmentResult)
			.where(
				and(
					eq(assessmentResult.studentId, studentId),
					eq(assessmentResult.tutorId, tutorId),
					sql`${assessmentResult.takenOn} >= ${from}`,
					sql`${assessmentResult.takenOn} <= ${to}`
				)
			)
			.limit(500)
	]);
	const past = lessons.filter((l) => l.endsAt.getTime() <= now.getTime());
	const missed = past.filter((l) => l.attendance === 'absent').length;
	const today = localDate(now);
	const byChapter = new Map<
		string,
		{ subject: string; chapter: string; s: number; m: number; n: number }
	>();
	let s = 0;
	let mx = 0;
	for (const r of results) {
		const k = `${r.subject.toLowerCase()}|${r.topic.toLowerCase()}`;
		const c = byChapter.get(k) ?? { subject: r.subject, chapter: r.topic, s: 0, m: 0, n: 0 };
		c.s += r.score;
		c.m += r.maxScore;
		c.n++;
		byChapter.set(k, c);
		s += r.score;
		mx += r.maxScore;
	}
	return {
		lessons: { booked: lessons.length, attended: past.length - missed, missed },
		homework: countHomework(
			hw.map((h) => ({
				mark: h.mark,
				handedIn: !!h.handedIn,
				overdue: !!h.dueOn && h.dueOn < today
			}))
		),
		checkins: { count: checks[0]?.n ?? 0, days: checks[0]?.days ?? 0 },
		tests: [...byChapter.values()]
			.map((c) => ({
				subject: c.subject,
				chapter: c.chapter,
				pct: c.m ? Math.round((100 * c.s) / c.m) : 0,
				tests: c.n
			}))
			.sort((a, b) => a.subject.localeCompare(b.subject) || a.chapter.localeCompare(b.chapter))
			.slice(0, 30),
		testAvg: mx ? Math.round((100 * s) / mx) : null
	};
}

const cleanNote = (v: unknown) => {
	const s = typeof v === 'string' ? v.trim() : '';
	return s ? s.slice(0, MAX_NOTE) : null;
};

/** A new draft report (the figures are worked out now). */
export async function createReport(
	db: DB,
	tutorId: string,
	studentId: string,
	period: { from: string; to: string },
	note: unknown,
	now = new Date(),
	noteVisible = false
) {
	if (!(await isEnrolled(db, tutorId, studentId))) throw new ReportFail('err_not_found');
	const p = cleanPeriod(period.from, period.to);
	const figures = await buildFigures(db, tutorId, studentId, p.from, p.to, now);
	const [row] = await db
		.insert(studentReport)
		.values({
			tutorId,
			studentId,
			periodStart: p.from,
			periodEnd: p.to,
			note: cleanNote(note),
			noteVisible: noteVisible === true,
			figures
		})
		.returning();
	return row;
}

/** Change the note (and refresh the figures) of one of MY reports. */
export async function updateReport(
	db: DB,
	tutorId: string,
	id: number,
	note: unknown,
	now = new Date(),
	noteVisible?: boolean
) {
	const r = await tutorReport(db, tutorId, id);
	if (!r) throw new ReportFail('err_not_found');
	const figures = await buildFigures(db, tutorId, r.studentId, r.periodStart, r.periodEnd, now);
	const [row] = await db
		.update(studentReport)
		.set({
			note: cleanNote(note),
			...(noteVisible === undefined ? {} : { noteVisible: noteVisible === true }),
			figures,
			updatedAt: now
		})
		.where(and(eq(studentReport.id, id), eq(studentReport.tutorId, tutorId)))
		.returning();
	return row;
}

export async function deleteReport(db: DB, tutorId: string, id: number) {
	const rows = await db
		.delete(studentReport)
		.where(
			and(
				eq(studentReport.id, id),
				eq(studentReport.tutorId, tutorId),
				eq(studentReport.status, 'draft')
			)
		)
		.returning({ id: studentReport.id });
	return rows.length > 0;
}

/** Send a report: the family who see progress are told. */
export async function sendReport(db: DB, tutorId: string, id: number, now = new Date()) {
	const [row] = await db
		.update(studentReport)
		.set({ status: 'sent', sentAt: now, updatedAt: now })
		.where(and(eq(studentReport.id, id), eq(studentReport.tutorId, tutorId)))
		.returning();
	if (!row) throw new ReportFail('err_not_found');
	const [s] = await db.select({ name: user.name }).from(user).where(eq(user.id, row.studentId));
	const child = firstName(s?.name ?? '');
	const tutor = await tutorNameOf(db, tutorId);
	for (const p of await parentsWhoSee(db, row.studentId, 'progress'))
		await notifyUser(
			db,
			p,
			m.rp_sent_fam_s({ name: child }),
			m.rp_sent_fam_b({ name: child, tutor }),
			{
				kind: 'family',
				link: `/parent/child/${encodeURIComponent(row.studentId)}#reports`
			}
		);
	return row;
}

export async function tutorReport(db: DB, tutorId: string, id: number) {
	const [r] = await db
		.select()
		.from(studentReport)
		.where(and(eq(studentReport.id, id), eq(studentReport.tutorId, tutorId)));
	return r ?? null;
}

/** All of this tutor's reports (optionally about one student), newest first. */
export function reportsByTutor(db: DB, tutorId: string, studentId?: string) {
	return db
		.select({
			id: studentReport.id,
			studentId: studentReport.studentId,
			studentName: user.name,
			periodStart: studentReport.periodStart,
			periodEnd: studentReport.periodEnd,
			status: studentReport.status,
			sentAt: studentReport.sentAt,
			note: studentReport.note,
			noteVisible: studentReport.noteVisible,
			figures: studentReport.figures,
			updatedAt: studentReport.updatedAt
		})
		.from(studentReport)
		.innerJoin(user, eq(user.id, studentReport.studentId))
		.where(
			and(
				eq(studentReport.tutorId, tutorId),
				studentId ? eq(studentReport.studentId, studentId) : undefined
			)
		)
		.orderBy(desc(studentReport.createdAt))
		.limit(100);
}

/** Sent reports about a child (for the family and the student), newest first. */
export function sentReportsFor(db: DB, studentId: string, limit = 12) {
	return db
		.select({
			id: studentReport.id,
			tutorId: studentReport.tutorId,
			periodStart: studentReport.periodStart,
			periodEnd: studentReport.periodEnd,
			note: studentReport.note,
			figures: studentReport.figures,
			sentAt: studentReport.sentAt
		})
		.from(studentReport)
		.where(and(eq(studentReport.studentId, studentId), eq(studentReport.status, 'sent')))
		.orderBy(desc(studentReport.sentAt))
		.limit(limit);
}

/** The newest sent reports about this child with the tutor's name (one query). */
export function sentReportsNamed(db: DB, studentId: string, limit = 3) {
	return db
		.select({
			id: studentReport.id,
			tutorId: studentReport.tutorId,
			periodStart: studentReport.periodStart,
			periodEnd: studentReport.periodEnd,
			note: studentReport.note,
			figures: studentReport.figures,
			sentAt: studentReport.sentAt,
			tutorName: sql<string>`coalesce(${tutorProfile.tutorName}, ${user.name}, '')`
		})
		.from(studentReport)
		.leftJoin(tutorProfile, eq(tutorProfile.tutorId, studentReport.tutorId))
		.leftJoin(user, eq(user.id, studentReport.tutorId))
		.where(and(eq(studentReport.studentId, studentId), eq(studentReport.status, 'sent')))
		.orderBy(desc(studentReport.sentAt))
		.limit(limit);
}

/** One sent report about this child, or null. */
export async function sentReport(db: DB, studentId: string, id: number) {
	const [r] = await db
		.select()
		.from(studentReport)
		.where(
			and(
				eq(studentReport.id, id),
				eq(studentReport.studentId, studentId),
				eq(studentReport.status, 'sent')
			)
		);
	return r ?? null;
}

/** Tutor names for a few report rows (one query). */
export async function tutorNames(db: DB, ids: string[]) {
	const uniq = [...new Set(ids)];
	if (!uniq.length) return new Map<string, string>();
	const rows = await db
		.select({ id: user.id, name: user.name, tutorName: tutorProfile.tutorName })
		.from(user)
		.leftJoin(tutorProfile, eq(tutorProfile.tutorId, user.id))
		.where(inArray(user.id, uniq));
	return new Map(rows.map((r) => [r.id, r.tutorName ?? r.name]));
}

/**
 * What the STUDENT may see of a report: the figures always, the tutor's note only when the
 * tutor chose "visible to student" (a parent-only note never leaves the server for them).
 */
export function forStudent<T extends { note: string | null; noteVisible: boolean }>(r: T) {
	const { note, noteVisible, ...rest } = r;
	return { ...rest, note: noteVisible ? note : null };
}

/** The student's own sent reports, newest first (parent-only notes removed). */
export async function studentReports(db: DB, studentId: string, limit = 12) {
	const rows = await db
		.select({
			id: studentReport.id,
			tutorId: studentReport.tutorId,
			periodStart: studentReport.periodStart,
			periodEnd: studentReport.periodEnd,
			note: studentReport.note,
			noteVisible: studentReport.noteVisible,
			figures: studentReport.figures,
			sentAt: studentReport.sentAt
		})
		.from(studentReport)
		.where(and(eq(studentReport.studentId, studentId), eq(studentReport.status, 'sent')))
		.orderBy(desc(studentReport.sentAt))
		.limit(limit);
	return rows.map(forStudent);
}
