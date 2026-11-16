/**
 * Connected Tools are shortcuts only (Teams, Meet, Zoom, Drive, Kahoot!): Tutora never signs
 * in to those accounts, makes meetings through their APIs or syncs anything. Lessons use the
 * tutor's own pasted meeting link (meeting-links.ts).
 *
 * What is left here: the person's small tool choices (Kahoot! on/off) and reading a meeting
 * link stored for a lesson by the old, removed API integration (old lessons keep their link).
 */
import { eq } from 'drizzle-orm';
import type { DB } from '../db/types.ts';
import { lessonMeeting, toolPref, type MeetingTool } from '../db/v3.schema.ts';

/** The person's tool choices (defaults when they never chose). */
export async function getToolPref(db: DB, userId: string) {
	const [p] = await db.select().from(toolPref).where(eq(toolPref.userId, userId));
	return { meetingTool: (p?.meetingTool ?? 'room') as MeetingTool, kahootOn: p?.kahootOn ?? false };
}

export async function setToolPref(db: DB, userId: string, v: { kahootOn?: boolean }) {
	const now = new Date();
	await db
		.insert(toolPref)
		.values({ userId, kahootOn: v.kahootOn ?? false })
		.onConflictDoUpdate({ target: toolPref.userId, set: { ...v, updatedAt: now } });
}

/** The meeting link stored for a lesson (from before links were pasted by tutors), if any. */
export async function meetingFor(db: DB, lessonId: number) {
	const [m] = await db
		.select({ provider: lessonMeeting.provider, joinUrl: lessonMeeting.joinUrl })
		.from(lessonMeeting)
		.where(eq(lessonMeeting.lessonId, lessonId));
	return m ?? null;
}
