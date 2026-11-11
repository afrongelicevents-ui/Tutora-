import { BETTER_AUTH_SECRET } from '$app/env/private';
import { getRequestEvent } from '$app/server';
import { R2Store, signedUrl, type FileStore } from './files.ts';
import { DbStore } from './db-store.ts';

/**
 * Where uploaded files live: a Cloudflare R2 bucket if one is connected (binding `FILES`),
 * otherwise the database itself, so the site works with no extra account.
 */
export function getStore(platform: App.Platform | undefined): FileStore {
	const bucket = platform?.env?.FILES;
	if (bucket) return new R2Store(bucket);
	return new DbStore(getRequestEvent().locals.db);
}

/** Short-lived link to a private file. Callers must check access first. */
export function fileLink(key: string, name: string) {
	return signedUrl(BETTER_AUTH_SECRET, key, name);
}
