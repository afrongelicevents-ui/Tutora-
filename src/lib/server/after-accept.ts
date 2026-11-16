/**
 * Everything that happens after a tutor accepts a booking:
 * messages to the student and their family. (The lesson's Join link is the tutor's own
 * Teams / Meet / Zoom link, saved on the student's page: nothing is made through an API.)
 */
import { shortName } from '../names.ts';
import { eq } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { user } from './db/auth.schema.ts';
import { notifyUser } from './notify.ts';
import { parentsWhoSee } from './family.ts';
import { fmtDayTime } from '../tz.ts';
import { m } from '../paraglide/messages.js';

export async function afterAccept(db: DB, r: { lessonId: number; userId: string; startsAt: Date }) {
	const when = fmtDayTime(r.startsAt);
	await notifyUser(db, r.userId, m.email_booked_s(), m.email_booked_b({ when }), {
		kind: 'booking',
		link: `/student/lessons/${r.lessonId}`
	});
	const [s] = await db.select({ name: user.name }).from(user).where(eq(user.id, r.userId));
	const child = shortName(s?.name ?? '');
	for (const parentId of await parentsWhoSee(db, r.userId, 'lessons')) {
		await notifyUser(
			db,
			parentId,
			m.fam_lesson_confirmed_s({ child }),
			m.fam_lesson_confirmed_b({ child, when }),
			{ kind: 'family_lesson', link: `/parent?child=${encodeURIComponent(r.userId)}` }
		);
	}
}
