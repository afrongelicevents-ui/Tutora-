import { error, json } from '@sveltejs/kit';
import { DATABASE_URL, TEST_SITE } from '$app/env/private';
import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleHttp } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { cleanUrl } from '#lib/server/db/index.ts';

/**
 * TEST SITE ONLY (404 elsewhere): runs the same 12 read queries with the WebSocket driver
 * (`ws`), the HTTP driver (`http`) or one HTTP batch (`batch`), so the CPU-time measurement
 * (scripts/perf/remote.mjs) can compare them on Cloudflare itself. Reads fake data only.
 */
const QUERIES = [
	sql`select id, starts_at, ends_at, status, mode from lesson order by starts_at desc limit 30`,
	sql`select a.lesson_id, a.user_id, a.attendance from attendee a order by a.id desc limit 30`,
	sql`select tutor_id, slug, tutor_name, status, headline from tutor_profile limit 10`,
	sql`select id, user_id, title, due_on from homework order by id desc limit 20`,
	sql`select count(*)::int as n from notification where read_at is null`,
	sql`select id, name, email, role from "user" limit 20`,
	sql`select student_id, mood, created_at from checkin order by created_at desc limit 20`,
	sql`select id, tutor_id, name, price_cents from subject limit 20`,
	sql`select user_id, sum(amount_cents)::int as s from payment group by user_id`,
	sql`select id, student_id, weekday, start_minute, minutes, subject from study_plan_item limit 20`,
	sql`select id, kind, title, body, created_at from notification order by created_at desc limit 20`,
	sql`select tutor_id, weekday, start_minute, end_minute from availability limit 20`
];

export const GET: RequestHandler = async ({ url, locals }) => {
	if (TEST_SITE !== '1') error(404, 'Not found');
	const mode = url.searchParams.get('driver') ?? 'ws';
	let rows = 0;
	if (mode === 'ws') {
		const r = await Promise.all(QUERIES.map((q) => locals.db.execute(q)));
		rows = (r as unknown as { rows?: unknown[] }[]).reduce(
			(a: number, x) => a + (x.rows?.length ?? 0),
			0
		);
	} else {
		const client = neon(cleanUrl(DATABASE_URL));
		if (mode === 'http') {
			const db = drizzleHttp(client);
			const r = await Promise.all(QUERIES.map((q) => db.execute(q)));
			rows = (r as unknown as { rows?: unknown[] }[]).reduce(
				(a: number, x) => a + (x.rows?.length ?? 0),
				0
			);
		} else {
			const db = drizzleHttp(client);
			const r = (await db.batch(QUERIES.map((q) => db.execute(q)) as never)) as unknown as {
				rows: unknown[];
			}[];
			rows = r.reduce((a, x) => a + (x.rows?.length ?? 0), 0);
		}
	}
	return json({ mode, rows });
};
