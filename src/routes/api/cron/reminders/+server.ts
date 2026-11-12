import { error, json } from '@sveltejs/kit';
import { CRON_SECRET, ORIGIN } from '$app/env/private';
import type { RequestHandler } from './$types';
import { sendDueReminders, sendStudyReminders } from '#lib/server/reminders.ts';
import { sendWeeklyReports } from '#lib/server/weekly.ts';
import { notifyUser, type NotifyOpts } from '#lib/server/notify.ts';

/** Constant-time comparison. */
function sameText(a: string, b: string) {
	if (a.length !== b.length) return false;
	let r = 0;
	for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return r === 0;
}

/** Called every hour by .github/workflows/reminders.yml with the CRON_SECRET. */
export const POST: RequestHandler = async ({ locals, request, url }) => {
	const given = request.headers.get('authorization') ?? '';
	if (!CRON_SECRET || CRON_SECRET.length < 24 || !sameText(given, `Bearer ${CRON_SECRET}`))
		error(404, 'Not found');
	const notify = (userId: string, subject: string, body: string, opts?: NotifyOpts) =>
		notifyUser(locals.db, userId, subject, body, opts);
	const sent = await sendDueReminders(locals.db, notify, ORIGIN ?? url.origin);
	// "Study time at 4:00 PM" for parents; a failure here never stops the lesson reminders
	const study = await sendStudyReminders(locals.db, notify).catch((e) => {
		console.error('study reminders failed', e);
		return 0;
	});
	// the weekly family report, Sunday from 5 PM (once per parent, child and week)
	const weekly = await sendWeeklyReports(locals.db, notify).catch((e) => {
		console.error('weekly reports failed', e);
		return 0;
	});
	return json({ sent, study, weekly });
};
