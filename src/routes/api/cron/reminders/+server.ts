import { error, json } from '@sveltejs/kit';
import { CRON_SECRET, ORIGIN } from '$app/env/private';
import type { RequestHandler } from './$types';
import { notifyUser, type NotifyOpts } from '#lib/server/notify.ts';
import { runScheduled } from '#lib/server/scheduled.ts';

/** Constant-time comparison. */
function sameText(a: string, b: string) {
	if (a.length !== b.length) return false;
	let r = 0;
	for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return r === 0;
}

/**
 * The hourly work, by hand (local development and the end-to-end tests). On the real
 * sites it runs from GitHub Actions straight against the database (scripts/deploy/
 * reminders.ts), so it never uses the Workers free CPU time.
 */
export const POST: RequestHandler = async ({ locals, request, url }) => {
	const given = request.headers.get('authorization') ?? '';
	if (!CRON_SECRET || CRON_SECRET.length < 24 || !sameText(given, `Bearer ${CRON_SECRET}`))
		error(404, 'Not found');
	const notify = (userId: string, subject: string, body: string, opts?: NotifyOpts) =>
		notifyUser(locals.db, userId, subject, body, opts);
	return json(await runScheduled(locals.db, notify, ORIGIN ?? url.origin));
};
