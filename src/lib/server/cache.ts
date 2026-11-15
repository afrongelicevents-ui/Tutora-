/**
 * Two small caches that keep each request inside the Workers free CPU budget
 * (see docs/FREE-LIMITS.md).
 *
 * - `perRequest`: the same lookup asked twice while building one page (e.g. a student's
 *   lessons, used by three cards) runs once. Keyed by the request's own database object,
 *   so nothing is ever shared between two people or two requests.
 * - `shared`: public, rarely-changing data (the platform's subject list, homepage text) is
 *   kept in the worker's memory for a short time. Only for data that is the same for
 *   everyone; never for anything personal.
 */
import type { DB } from './db/types.ts';

const byRequest = new WeakMap<object, Map<string, Promise<unknown>>>();

/**
 * Turned on by the request hook for GET requests only: a form action writes, then the page
 * loads again in the same request, and that load must see the new data. Tests and scripts
 * never turn it on, so they always read fresh.
 */
export function rememberForThisRequest(db: DB) {
	byRequest.set(db, new Map());
}

export function perRequest<T>(db: DB, key: string, fn: () => PromiseLike<T>): Promise<T> {
	const m = byRequest.get(db);
	if (!m) return Promise.resolve().then(fn);
	let p = m.get(key) as Promise<T> | undefined;
	if (!p) {
		// (a database query builder is only a 'thenable': this turns it into a real Promise)
		p = Promise.resolve().then(fn);
		m.set(key, p);
		// a failed lookup is not remembered
		p.catch(() => m.delete(key));
	}
	return p;
}

const SHARED_MAX = 200;
const shared = new Map<string, { until: number; value: Promise<unknown> }>();

export function sharedFor<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
	const now = Date.now();
	const hit = shared.get(key);
	if (hit && hit.until > now) return hit.value as Promise<T>;
	const value = fn();
	if (shared.size >= SHARED_MAX) shared.delete(shared.keys().next().value!);
	shared.set(key, { until: now + ttlMs, value });
	value.catch(() => shared.delete(key));
	return value;
}

/** After the owner changes public data, this worker shows the change at once. */
export function forgetShared(prefix: string) {
	for (const k of shared.keys()) if (k.startsWith(prefix)) shared.delete(k);
}
