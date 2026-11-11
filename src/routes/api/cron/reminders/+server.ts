import { error, json } from '@sveltejs/kit';
import { CRON_SECRET, ORIGIN } from '$app/env/private';
import type { RequestHandler } from './$types';
import { sendDueReminders } from '#lib/server/reminders.ts';
import { sendEmail } from '#lib/server/auth.ts';

/** Called every hour by .github/workflows/reminders.yml with the CRON_SECRET. */
export const POST: RequestHandler = async ({ locals, request }) => {
	const given = request.headers.get('authorization') ?? '';
	if (!CRON_SECRET || CRON_SECRET.length < 24 || given !== `Bearer ${CRON_SECRET}`)
		error(404, 'Not found');
	const sent = await sendDueReminders(locals.db, sendEmail, ORIGIN);
	return json({ sent });
};
