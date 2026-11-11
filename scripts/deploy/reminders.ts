// Hourly lesson and homework reminders, run by .github/workflows/reminders.yml straight
// against the database (no extra secrets needed: the job finds the database with NEON_API_KEY).
// They appear in each person's Tutora notifications (the bell).
// Env: DATABASE_URL, SITE_URL.
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '../../src/lib/server/db/schema.ts';
import type { DB } from '../../src/lib/server/db/types.ts';
import { sendDueReminders, sendHomeworkReminders } from '../../src/lib/server/reminders.ts';
import { saveNotification } from '../../src/lib/server/notify-core.ts';

async function main() {
	const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
	const db = drizzle(pool, { schema }) as unknown as DB;
	try {
		const notify = async (
			userId: string,
			subject: string,
			body: string,
			opts?: Parameters<typeof saveNotification>[4]
		) => {
			await saveNotification(db, userId, subject, body, opts);
		};
		const site = (process.env.SITE_URL ?? '').replace(/\/$/, '');
		const lessons = await sendDueReminders(db, notify, site);
		const homework = await sendHomeworkReminders(db, notify);
		console.log(`Reminders: ${lessons} lesson, ${homework} homework.`);
	} finally {
		await pool.end();
	}
}

main().catch((e) => {
	console.log(`::error::Reminders failed (${e?.cause?.code ?? e?.name ?? 'error'}).`);
	process.exit(1);
});
