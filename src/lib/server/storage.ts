import { dev } from '$app/env';
import { BETTER_AUTH_SECRET } from '$app/env/private';
import { error } from '@sveltejs/kit';
import { LocalStore, R2Store, signedUrl, type FileStore } from './files.ts';

/** R2 bucket binding `FILES` in production, a local folder in development. */
export function getStore(platform: App.Platform | undefined): FileStore {
	const bucket = platform?.env?.FILES;
	if (bucket) return new R2Store(bucket);
	if (dev) return new LocalStore();
	error(500, 'File storage is not configured');
}

/** Short-lived link to a private file. Callers must check access first. */
export function fileLink(key: string, name: string) {
	return signedUrl(BETTER_AUTH_SECRET, key, name);
}
