import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import * as schema from '../db/schema.ts';
import type { DB } from '../db/types.ts';
import { createAuth } from '../auth-config.ts';

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
export const hasTestDb = !!TEST_DATABASE_URL;

/**
 * A brand-new database for each test file (so files can run in parallel),
 * built with the real migrations. Dropped again afterwards.
 */
export async function freshDb(): Promise<{ db: DB; close: () => Promise<void> }> {
	const name = `tutora_t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
	const admin = new pg.Client({ connectionString: TEST_DATABASE_URL });
	await admin.connect();
	await admin.query(`create database "${name}"`);
	await admin.end();

	const url = new URL(TEST_DATABASE_URL!);
	url.pathname = `/${name}`;
	const pool = new pg.Pool({ connectionString: url.toString(), max: 3 });
	const db = drizzle(pool, { schema });
	await migrate(db, { migrationsFolder: './drizzle' });

	return {
		db: db as unknown as DB,
		close: async () => {
			await pool.end();
			const a = new pg.Client({ connectionString: TEST_DATABASE_URL });
			await a.connect();
			await a.query(`drop database if exists "${name}" with (force)`);
			await a.end();
		}
	};
}

export interface SentEmail {
	to: string;
	subject: string;
	text: string;
}

export const TUTOR_EMAIL = 'tutor@example.com';

export function testAuth(db: DB) {
	const outbox: SentEmail[] = [];
	const auth = createAuth({
		db,
		baseURL: 'http://localhost:5173',
		secret: 'test-secret-test-secret-test-secret-123',
		tutorEmail: TUTOR_EMAIL,
		transactions: true,
		sendEmail: async (msg) => {
			outbox.push(msg);
		}
	});
	return { auth, outbox };
}

/** Pull the first link out of an email body. */
export function linkIn(email: SentEmail | undefined): URL {
	const match = email?.text.match(/https?:\/\/\S+/);
	if (!match) throw new Error('no link in email');
	return new URL(match[0]);
}

/** Turn Set-Cookie headers into a Cookie header for the next request. */
export function cookieHeader(res: Response | Headers, previous = ''): string {
	const headers = res instanceof Response ? res.headers : res;
	const jar = new Map<string, string>();
	for (const part of previous.split(/;\s*/).filter(Boolean)) {
		const [k, ...v] = part.split('=');
		jar.set(k, v.join('='));
	}
	for (const c of headers.getSetCookie()) {
		const [pair] = c.split(';');
		const [k, ...v] = pair.split('=');
		if (v.join('=') === '') jar.delete(k);
		else jar.set(k, v.join('='));
	}
	return [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
}
