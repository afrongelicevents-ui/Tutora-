/**
 * Homework lives in Tutora: the tutor sets it with a due date and time, the child hands in
 * a photo or file, the tutor marks it done, late or missing, and the family sees it at once.
 *
 * - Late: an answer that came in after the due time is suggested as "late" (the tutor can
 *   change it).
 * - Missing: the hourly job marks homework with nothing handed in as "missing" once the due
 *   time is MISSING_AFTER_H hours past; the student and the family who see homework are told.
 *   The tutor can change it, and handing in later still works.
 */
import { and, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { homework, HOMEWORK_MARKS, type HomeworkMark } from './db/app.schema.ts';
import { user } from './db/auth.schema.ts';
import type { Notify } from './notify-core.ts';
import { parentsWhoSee } from './family.ts';
import { firstName } from './study.ts';
import { fromLocal, hhmmToMinutes, localDate } from '../tz.ts';
import { m } from '../paraglide/messages.js';

/** Hours after the due time before the hourly job marks it missing. */
export const MISSING_AFTER_H = 24;
const HOUR = 3_600_000;

export const isHomeworkMark = (v: unknown): v is HomeworkMark =>
	typeof v === 'string' && (HOMEWORK_MARKS as readonly string[]).includes(v);

/** "HH:MM" (00:00–23:59) or null. */
export function cleanDueTime(v: unknown): string | null {
	if (typeof v !== 'string' || !v.trim()) return null;
	const mins = hhmmToMinutes(v.trim());
	if (mins === null || mins < 0 || mins >= 1440) return null;
	return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

/** The moment homework is due (Zimbabwe time); no time = the end of that day. */
export function dueAt(dueOn: string | null, dueTime: string | null): Date | null {
	if (!dueOn) return null;
	const mins = dueTime ? hhmmToMinutes(dueTime) : null;
	return fromLocal(dueOn, mins ?? 24 * 60 - 1);
}

/** Was an answer handed in after the due time? */
export function handedInLate(at: Date, dueOn: string | null, dueTime: string | null): boolean {
	const d = dueAt(dueOn, dueTime);
	return !!d && at.getTime() > d.getTime() + 59_999;
}

/** The mark to suggest when the tutor marks an answer. */
export function suggestedMark(
	answerAt: Date | null,
	dueOn: string | null,
	dueTime: string | null
): HomeworkMark {
	if (!answerAt) return 'missing';
	return handedInLate(answerAt, dueOn, dueTime) ? 'late' : 'done';
}

/** Is it time for the hourly job to call this homework missing? */
export function isOverdueForMissing(
	dueOn: string | null,
	dueTime: string | null,
	now = new Date()
): boolean {
	const d = dueAt(dueOn, dueTime);
	return !!d && now.getTime() >= d.getTime() + MISSING_AFTER_H * HOUR;
}

/** The tutor sets (or clears, with null) the mark on THEIR homework. */
export async function setHomeworkMark(
	db: DB,
	tutorId: string,
	homeworkId: number,
	mark: HomeworkMark | null,
	now = new Date()
) {
	const rows = await db
		.update(homework)
		.set({ mark, markedAt: mark ? now : null, markAuto: false })
		.where(and(eq(homework.id, homeworkId), eq(homework.tutorId, tutorId)))
		.returning({ id: homework.id, userId: homework.userId, title: homework.title });
	return rows[0] ?? null;
}

/** Tell the student and the family who see homework about a mark. */
export async function tellHomeworkMark(
	db: DB,
	notify: Notify,
	h: { userId: string; title: string },
	mark: HomeworkMark
) {
	const [u] = await db.select({ name: user.name }).from(user).where(eq(user.id, h.userId));
	const child = firstName(u?.name ?? '');
	const label = mark === 'done' ? m.hws_done() : mark === 'late' ? m.hws_late() : m.hws_missing();
	await notify(h.userId, m.hws_mark_s({ title: h.title, mark: label }), m.hws_mark_b(), {
		kind: 'homework',
		link: '/student/homework'
	}).catch(() => {});
	for (const p of await parentsWhoSee(db, h.userId, 'homework'))
		await notify(
			p,
			m.hws_mark_fam_s({ name: child, mark: label }),
			m.hws_mark_fam_b({ name: child, title: h.title, mark: label }),
			{ kind: 'homework', link: `/parent/child/${encodeURIComponent(h.userId)}` }
		).catch(() => {});
}

/**
 * Hourly: homework past its due time by MISSING_AFTER_H hours with nothing handed in and no
 * mark yet becomes "missing". Each row is claimed in the same update, so it is told once.
 */
export async function markMissingHomework(db: DB, notify: Notify, now = new Date()) {
	// a cheap first filter in SQL (due date at least a day ago), the exact time check here
	const cutoff = localDate(new Date(now.getTime() - MISSING_AFTER_H * HOUR));
	const candidates = await db
		.select({
			id: homework.id,
			dueOn: homework.dueOn,
			dueTime: homework.dueTime
		})
		.from(homework)
		.where(
			and(
				isNotNull(homework.dueOn),
				isNull(homework.mark),
				sql`${homework.dueOn} <= ${cutoff}`,
				// only the last week: old lists from before marks existed stay as they were
				sql`${homework.dueOn} >= ${localDate(new Date(now.getTime() - 7 * 24 * HOUR))}`,
				sql`not exists (select 1 from homework_answer a where a.homework_id = "homework"."id")`
			)
		)
		.limit(500);
	const due = candidates.filter((h) => isOverdueForMissing(h.dueOn, h.dueTime, now));
	if (!due.length) return 0;
	const claimed = await db
		.update(homework)
		.set({ mark: 'missing', markedAt: now, markAuto: true })
		.where(
			and(
				inArray(
					homework.id,
					due.map((h) => h.id)
				),
				isNull(homework.mark),
				sql`not exists (select 1 from homework_answer a where a.homework_id = "homework"."id")`
			)
		)
		.returning({ userId: homework.userId, title: homework.title });
	for (const h of claimed) await tellHomeworkMark(db, notify, h, 'missing');
	return claimed.length;
}
