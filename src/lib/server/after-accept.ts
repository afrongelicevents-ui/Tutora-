/**
 * Everything that happens after a tutor accepts a booking:
 * the meeting link (if a tool is connected), then messages to the student and their family.
 */
import { eq } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { user } from './db/auth.schema.ts';
import { notifyUser } from './notify.ts';
import { parentsWhoSee } from './family.ts';
import { createMeetingForLesson, type ToolsEnv } from './tools/meetings.ts';
import { fmtDayTime } from '../tz.ts';
import { m } from '../paraglide/messages.js';

export async function afterAccept(
	db: DB,
	env: ToolsEnv,
	r: { lessonId: number; userId: string; startsAt: Date }
) {
	let meeting: Awaited<ReturnType<typeof createMeetingForLesson>> = null;
	try {
		meeting = await createMeetingForLesson(db, env, r.lessonId);
	} catch {
		meeting = null; // the lesson still works in the low-data room
	}
	const when = fmtDayTime(r.startsAt);
	await notifyUser(db, r.userId, m.email_booked_s(), m.email_booked_b({ when }), {
		kind: 'booking',
		link: `/student/lessons/${r.lessonId}`
	});
	const [s] = await db.select({ name: user.name }).from(user).where(eq(user.id, r.userId));
	const child = (s?.name ?? '').trim().split(/\s+/)[0];
	for (const parentId of await parentsWhoSee(db, r.userId, 'lessons')) {
		await notifyUser(
			db,
			parentId,
			m.fam_lesson_confirmed_s({ child }),
			m.fam_lesson_confirmed_b({ child, when }),
			{ kind: 'family_lesson', link: `/parent?child=${encodeURIComponent(r.userId)}` }
		);
	}
	return { meeting };
}
