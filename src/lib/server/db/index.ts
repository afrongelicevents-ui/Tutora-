import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzleHttp } from 'drizzle-orm/neon-http';
import { neon, Pool as NeonPool } from '@neondatabase/serverless';
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
export async function openDb(rawUrl: string, opts: { http?: boolean } = {}): Promise<RequestDb> {
	const url = cleanUrl(rawUrl);
	if (dev && isLocal(url)) {
		localPool ??= localDb(url);
		// a fresh object per request on top of the shared pool, so per-request caches stay per request
		return { db: Object.create(await localPool) as DB, close: async () => {} };
	}
	if (opts.http) return httpDb(url);
	const pool = new NeonPool({ connectionString: url, max: 2 });
	// no relational schema: the app never uses db.query.*, and building it costs CPU per request
	return { db: drizzleNeon(pool) as unknown as DB, close: () => pool.end() };
}

/**
 * Reading pages over Neon's HTTP endpoint: each query is one small HTTPS request whose JSON
 * answer the Cloudflare runtime parses natively, instead of decoding the database protocol
 * in JavaScript over a WebSocket. A transaction (rare on a reading page) opens the WebSocket
 * connection only then.
 */
function httpDb(url: string): RequestDb {
	const db = drizzleHttp(batching(neon(url)) as never) as unknown as DB & {
		transaction: DB['transaction'];
	};
	let pool: NeonPool | null = null;
	let ws: DB | null = null;
	db.transaction = ((fn: never, config?: never) => {
		pool ??= new NeonPool({ connectionString: url, max: 1 });
		ws ??= drizzleNeon(pool) as unknown as DB;
		return ws.transaction(fn, config);
	}) as DB['transaction'];
	return { db, close: async () => void (await pool?.end()) };
}

type Neon = ReturnType<typeof neon>;
interface Waiting {
	query: string;
	params: unknown[];
	opts: Parameters<Neon['query']>[2];
	resolve: (v: unknown) => void;
	reject: (e: unknown) => void;
}

/**
 * Queries a page starts at the same moment (its `Promise.all`s) go to Neon together as one
 * HTTP batch instead of one request each: on Cloudflare 12 queries cost ~4 ms of CPU batched
 * against ~8 ms one by one (measured on the test site). If a batch fails (one query errors),
 * each query is run again on its own so every caller gets its own answer or error.
 */
export function batching(sql: Neon) {
	let queue: Waiting[] = [];
	let scheduled = false;
	const one = (w: Waiting) => sql.query(w.query, w.params, w.opts).then(w.resolve, w.reject);
	const flush = async () => {
		const q = queue;
		queue = [];
		scheduled = false;
		if (q.length === 1) return void one(q[0]);
		try {
			const results = await sql.transaction(q.map((w) => sql.query(w.query, w.params, w.opts)));
			results.forEach((r, i) => q[i].resolve(r));
		} catch {
			for (const w of q) void one(w);
		}
	};
	return {
		query(query: string, params: unknown[] = [], opts?: Waiting['opts']) {
			return new Promise((resolve, reject) => {
				queue.push({ query, params, opts, resolve, reject });
				if (!scheduled) {
					scheduled = true;
					setTimeout(flush, 0);
				}
			});
		},
		transaction: sql.transaction
	};
}
