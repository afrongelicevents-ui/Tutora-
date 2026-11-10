import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { dev } from '$app/env';
import { DATABASE_URL } from '$app/env/private';
import * as schema from './schema';
import type { DB } from './types';

const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(DATABASE_URL);

async function localDb(url: string): Promise<DB> {
	// Only used by `vite dev` against a local Postgres; removed from production builds.
	const { drizzle } = await import('drizzle-orm/node-postgres');
	const pg = await import('pg');
	return drizzle(new pg.default.Pool({ connectionString: url }), { schema }) as unknown as DB;
}

export const usesTransactions = dev && isLocal;

export const db: DB =
	dev && isLocal
		? await localDb(DATABASE_URL)
		: (drizzleNeon(neon(DATABASE_URL), { schema }) as unknown as DB);
