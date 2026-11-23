/**
 * What the service worker may do with each request (src/service-worker.ts). Kept as a
 * pure function so the rules are tested (sw-policy.test.ts).
 *
 * - `cache`: the app shell only: built files under /_app/ and the public files in
 *   /static (icons, fonts, photos, the offline page). They hold no personal data.
 * - `network-or-offline`: a page the person opens. Always from the network, never stored;
 *   with no connection the "You're offline" page is shown instead.
 * - `network`: everything else (page data, forms, /api, files, receipts, payments...):
 *   straight to the network, never stored, no offline copy.
 */
export type SwPolicy = 'cache' | 'network-or-offline' | 'network';

export function cachePolicy(
	url: URL,
	req: { method: string; mode?: string },
	shell: ReadonlySet<string>,
	origin: string
): SwPolicy {
	if (req.method !== 'GET' || url.origin !== origin) return 'network';
	// signed links to private files and anything with a query string are never stored
	if (url.search && !url.pathname.startsWith('/_app/immutable/')) {
		return req.mode === 'navigate' ? 'network-or-offline' : 'network';
	}
	if (url.pathname.startsWith('/_app/immutable/')) return 'cache';
	if (shell.has(url.pathname) && !url.pathname.endsWith('__data.json')) return 'cache';
	return req.mode === 'navigate' ? 'network-or-offline' : 'network';
}
