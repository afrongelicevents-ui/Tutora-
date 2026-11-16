/**
 * Everything Tutora does on a timer, in one place. Run every hour by the GitHub job
 * (.github/workflows/reminders.yml → scripts/deploy/reminders.ts), which talks to the
 * database directly: this work never runs inside a Cloudflare request, so it uses none of
 * the Workers free CPU time or daily requests (see docs/FREE-LIMITS.md).
 *
 * Each job claims its rows before telling anyone, so two runs never send the same thing
 * twice. A failing job never stops the others.
 */
import { eq } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { user } from './db/auth.schema.ts';
import type { Notify } from './notify-core.ts';
import { sendDueReminders, sendHomeworkReminders, sendStudyReminders } from './reminders.ts';
import { sendWeeklyReports } from './weekly.ts';
import {
	MOOD_KEY,
	sendCheckinFollowups,
	sendDaySummaries,
	sendSharedCheckinNotes,
	type CheckinMood
} from './checkins.ts';
import { sendPlannerMornings } from './planner.ts';
import { activeParents } from './family.ts';
import { runFamilyBilling } from './family-billing.ts';
import { shortName } from '../names.ts';
import { t } from '../i18n.ts';
import { m } from '../paraglide/messages.js';

/** "Tatenda checked in: motivated" to the parents who follow the child (only the feeling). */
export async function tellFamilyAbout(
	db: DB,
	notify: Notify,
	studentId: string,
	mood: CheckinMood
) {
	const [me] = await db.select({ name: user.name }).from(user).where(eq(user.id, studentId));
	const first = shortName(me?.name ?? '');
	for (const parentId of await activeParents(db, studentId))
		await notify(
			parentId,
			m.ci_notify_s({ name: first }),
			m.ci_notify_b({ mood: t(MOOD_KEY[mood]) }),
			{ kind: 'family', link: `/parent?child=${encodeURIComponent(studentId)}` }
		);
}

export async function runScheduled(db: DB, notify: Notify, origin: string, now = new Date()) {
	const counts: Record<string, number | string> = {};
	const run = async (name: string, fn: () => Promise<number>) => {
		try {
			counts[name] = await fn();
		} catch (e) {
			counts[name] = 'failed';
			console.error(`${name} failed`, e instanceof Error ? e.name : 'error');
		}
	};
	await run('lessons', () => sendDueReminders(db, notify, origin, now));
	await run('homework', () => sendHomeworkReminders(db, notify, now));
	await run('study', () => sendStudyReminders(db, notify, now));
	await run('weekly', () => sendWeeklyReports(db, notify, now));
	await run('followups', () => sendCheckinFollowups(db, notify, now));
	await run('days', () => sendDaySummaries(db, notify, now));
	await run('mornings', () => sendPlannerMornings(db, notify, now));
	// Tutora Family: next invoices, payment reminders, free level after 7 days unpaid
	await run('family', () => runFamilyBilling(db, notify, now));
	await run('shared', () =>
		sendSharedCheckinNotes(db, (sid, mood) => tellFamilyAbout(db, notify, sid, mood), now)
	);
	return counts;
}
