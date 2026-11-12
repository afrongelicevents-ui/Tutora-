/**
 * Learning check-ins. The student picks how learning feels and decides, for each check-in,
 * whether their family sees it. A private note is never shown to family.
 */
import { and, desc, eq, gte } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { checkin, CHECKIN_MOODS, type CheckinMood } from './db/v3.schema.ts';
import { startOfLocalDay } from '../tz.ts';

export { CHECKIN_MOODS, type CheckinMood };

export function isMood(v: unknown): v is CheckinMood {
	return typeof v === 'string' && (CHECKIN_MOODS as readonly string[]).includes(v);
}

/** Message key for each mood (labels live in messages/en.json). */
export const MOOD_KEY: Record<CheckinMood, string> = {
	confident: 'ci_confident',
	finding_hard: 'ci_finding_hard',
	need_help: 'ci_need_help',
	motivated: 'ci_motivated',
	need_break: 'ci_need_break'
};

export async function addCheckin(
	db: DB,
	studentId: string,
	v: { mood: CheckinMood; shared: boolean; note?: string | null; subject?: string | null }
) {
	const [row] = await db
		.insert(checkin)
		.values({
			studentId,
			mood: v.mood,
			sharedWithFamily: v.shared,
			note: v.note?.trim().slice(0, 500) || null,
			subject: v.subject?.trim().slice(0, 60) || null
		})
		.returning();
	return row;
}

/** Today's latest check-in by this student (for their home screen). */
export async function todaysCheckin(db: DB, studentId: string, now = new Date()) {
	const [row] = await db
		.select()
		.from(checkin)
		.where(and(eq(checkin.studentId, studentId), gte(checkin.createdAt, startOfLocalDay(now))))
		.orderBy(desc(checkin.createdAt))
		.limit(1);
	return row ?? null;
}

/** The student changes their mind about sharing one of their own check-ins. */
export async function setCheckinShared(db: DB, studentId: string, id: number, shared: boolean) {
	await db
		.update(checkin)
		.set({ sharedWithFamily: shared })
		.where(and(eq(checkin.id, id), eq(checkin.studentId, studentId)));
}

/** Only the check-ins the child shared, without any note. Callers check the family link first. */
export function sharedCheckins(db: DB, studentId: string, since: Date, limit = 10) {
	return db
		.select({ id: checkin.id, mood: checkin.mood, subject: checkin.subject, createdAt: checkin.createdAt })
		.from(checkin)
		.where(
			and(
				eq(checkin.studentId, studentId),
				eq(checkin.sharedWithFamily, true),
				gte(checkin.createdAt, since)
			)
		)
		.orderBy(desc(checkin.createdAt))
		.limit(limit);
}

/** The latest check-in a tutor may see (the student shares check-ins with tutors by default). */
export async function latestForTutor(db: DB, studentId: string) {
	const [row] = await db
		.select({ mood: checkin.mood, subject: checkin.subject, createdAt: checkin.createdAt })
		.from(checkin)
		.where(and(eq(checkin.studentId, studentId), eq(checkin.sharedWithTutor, true)))
		.orderBy(desc(checkin.createdAt))
		.limit(1);
	return row ?? null;
}

export function recentCheckins(db: DB, studentId: string, limit = 20) {
	return db
		.select()
		.from(checkin)
		.where(eq(checkin.studentId, studentId))
		.orderBy(desc(checkin.createdAt))
		.limit(limit);
}
