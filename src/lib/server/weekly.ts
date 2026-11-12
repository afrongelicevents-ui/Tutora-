/**
 * "Weekly report ready" for parents: Sunday from 5 PM Zimbabwe time, once per parent, child
 * and week, only to parents actively connected and only if they haven't switched it off
 * (the notification itself respects the "weekly" setting).
 */
import { eq } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { familyLink, weeklyReportSent } from './db/v3.schema.ts';
import { user } from './db/auth.schema.ts';
import type { NotifyOpts } from './notify.ts';
import { local, localDate, startOfLocalWeek } from '../tz.ts';
import { shortName } from '../names.ts';
import { m } from '../paraglide/messages.js';

type Notify = (userId: string, subject: string, body: string, opts?: NotifyOpts) => Promise<void>;

export async function sendWeeklyReports(db: DB, notify: Notify, now = new Date()) {
	const { weekday, minutes } = local(now);
	if (weekday !== 0 || minutes < 17 * 60) return 0;
	const weekStart = localDate(startOfLocalWeek(now));
	const links = await db
		.select({ parentId: familyLink.parentId, studentId: familyLink.studentId, name: user.name })
		.from(familyLink)
		.innerJoin(user, eq(user.id, familyLink.studentId))
		.where(eq(familyLink.status, 'active'));
	let n = 0;
	for (const l of links) {
		const done = await db
			.insert(weeklyReportSent)
			.values({ parentId: l.parentId, studentId: l.studentId, weekStart })
			.onConflictDoNothing()
			.returning({ p: weeklyReportSent.parentId });
		if (!done.length) continue;
		const child = shortName(l.name);
		await notify(l.parentId, m.wk3_ready_s({ child }), m.wk3_ready_b({ child }), {
			kind: 'weekly',
			link: `/parent/report?child=${encodeURIComponent(l.studentId)}&week=${weekStart}`
		});
		n++;
	}
	return n;
}
