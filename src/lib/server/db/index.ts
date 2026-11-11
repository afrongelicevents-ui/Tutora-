import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { Pool as NeonPool } from '@neondatabase/serverless';
import { dev } from '$app/env';
import * as schema from './schema';
import type { DB } from './types';

export interface RequestDb {
	db: DB;
	close: () => Promise<void>;
}

/** Neon's copy button adds `channel_binding=require`, which the serverless driver can't use. */
export function cleanUrl(url: string): string {
	try {
		const u = new URL(url);
		u.searchParams.delete('channel_binding');
		return u.toString();
	} catch {
		return url;
	}
}

const isLocal = (url: string) => /@(localhost|127\.0\.0\.1)[:/]/.test(url);
let localPool: Promise<DB> | null = null;

async function localDb(url: string): Promise<DB> {
	// Only used by `vite dev` against a local Postgres; removed from production builds.
	const { drizzle } = await import('drizzle-orm/node-postgres');
	const pg = await import('pg');
	return drizzle(new pg.default.Pool({ connectionString: url, max: 5 }), {
		schema
	}) as unknown as DB;
}

/**
 * A database connection for one request. On Cloudflare Workers a connection cannot be
 * shared between requests, so each request opens a small Neon pool (over WebSocket,
 * which supports transactions) and closes it when the response is done.
 */
export async function openDb(rawUrl: string): Promise<RequestDb> {
	const url = cleanUrl(rawUrl);
	if (dev && isLocal(url)) {
		localPool ??= localDb(url);
		return { db: await localPool, close: async () => {} };
	}
	const pool = new NeonPool({ connectionString: url, max: 2 });
	return { db: drizzleNeon(pool, { schema }) as unknown as DB, close: () => pool.end() };
}
