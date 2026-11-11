import { error, json } from '@sveltejs/kit';
import { CRON_SECRET, ORIGIN } from '$app/env/private';
import type { RequestHandler } from './$types';
import { sendDueReminders } from '#lib/server/reminders.ts';
import { sendEmail } from '#lib/server/auth.ts';

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
	const sent = await sendDueReminders(locals.db, sendEmail, ORIGIN ?? url.origin);
	return json({ sent });
};
