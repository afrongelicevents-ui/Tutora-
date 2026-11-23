// Everything Tutora does on a timer (lesson and homework reminders, study-time alerts, the
// weekly family report, check-in follow-ups and day summaries, planner mornings, shared
// check-in notes), run hourly by .github/workflows/reminders.yml straight against the
// database. Nothing here runs on Cloudflare, so it uses none of the Workers free limits.
// Notifications appear in the bell; they are also emailed once an email service is set up
// (RESEND_API_KEY), to people who allow that kind of email.
// Env: DATABASE_URL, SITE_URL, optional RESEND_API_KEY and EMAIL_FROM.
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import type { DB } from '../../src/lib/server/db/types.ts';
import { saveNotification } from '../../src/lib/server/notify-core.ts';
import { createSendEmail } from '../../src/lib/server/email.ts';
import { runScheduled } from '../../src/lib/server/scheduled.ts';
import { m } from '../../src/lib/paraglide/messages.js';

async function main() {
	const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
	const db = drizzle(pool) as unknown as DB;
	const key = process.env.RESEND_API_KEY?.trim();
	const brevo = process.env.BREVO_API_KEY?.trim();
	const send =
		key || brevo
			? createSendEmail({
					apiKey: key,
					brevoApiKey: brevo,
					from: process.env.EMAIL_FROM,
					production: true
				})
			: null;
	try {
		const notify = async (
			userId: string,
			subject: string,
			body: string,
			opts?: Parameters<typeof saveNotification>[4]
		) => {
			const r = await saveNotification(db, userId, subject, body, opts);
			if (send && r?.sendEmail)
				await send({
					to: r.email,
					subject,
					text: `${m.email_hello({ name: r.name })}\n\n${body}\n\n${m.email_sign()}`
				}).catch(() => {});
		};
		const site = (process.env.SITE_URL ?? '').replace(/\/$/, '');
		const counts = await runScheduled(db, notify, site);
		// counts only (the repository is public)
		console.log(
			'Hourly jobs:',
			Object.entries(counts)
				.map(([k, v]) => `${k} ${v}`)
				.join(', ')
		);
		if (Object.values(counts).includes('failed')) process.exitCode = 1;
	} finally {
		await pool.end();
	}
}

main().catch((e) => {
	console.log(`::error::Hourly jobs failed (${e?.cause?.code ?? e?.name ?? 'error'}).`);
	process.exit(1);
});
