/**
 * Tutora's service worker: the app opens fast and works on weak data.
 *
 * - On install it keeps a small app shell: the start-up code, styles, fonts, icons and
 *   the "You're offline" page. Other built files are kept the first time they load.
 * - Pages, page data, forms, files, receipts and payments always come from the network
 *   and are NEVER stored (see cachePolicy in src/lib/sw-policy.ts).
 * - With no connection, opening a page shows the offline page.
 * - A new version replaces the old store when it takes over.
 */
import { immutable, assets } from '$app/manifest';
import { version } from '$app/env';
import { self } from '$app/service-worker';
import { cachePolicy } from '../lib/sw-policy.ts';

const sw = self;
/** paths come relative to the site root: make them absolute */
const abs = (p: string) => (p.startsWith('/') ? p : `/${p}`);
const files: string[] = assets.map((a) => abs(a.path));
const build: string[] = immutable.map((a) => abs(a.path));
const CACHE = `tutora-shell-${version}`;
/** the offline page: static/offline.html, which Cloudflare serves at /offline */
const OFFLINE = '/offline';

/** public files that are part of the shell (never the photos: they load when needed) */
const shellFiles = files.filter(
	(f) =>
		f === '/offline.html' ||
		f === '/manifest.webmanifest' ||
		f.startsWith('/fonts/') ||
		f === '/icons/icon-192.png' ||
		f === '/icons/icon-512.png' ||
		f === '/icons/apple-touch-icon.png'
);
/** built files every page needs: the start-up code, the root layout and its styles, fonts */
const shellBuild = build.filter(
	(f) =>
		f.includes('/entry/') ||
		f.includes('/nodes/0.') ||
		f.includes('/assets/0.') ||
		f.endsWith('.woff2')
);
const SHELL = new Set([OFFLINE, ...files, ...build]);

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((c) =>
				c.addAll([OFFLINE, ...shellFiles.filter((f) => f !== '/offline.html'), ...shellBuild])
			)
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys.filter((k) => k.startsWith('tutora-') && k !== CACHE).map((k) => caches.delete(k))
				)
			)
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	const req = event.request;
	const url = new URL(req.url);
	const policy = cachePolicy(url, req, SHELL, sw.location.origin);
	if (policy === 'network') return; // the browser handles it as if there were no worker

	if (policy === 'cache') {
		event.respondWith(
			caches.open(CACHE).then(async (cache) => {
				const hit = await cache.match(url.pathname);
				if (hit) return hit;
				const res = await fetch(req);
				if (res.ok && res.type === 'basic') cache.put(url.pathname, res.clone());
				return res;
			})
		);
		return;
	}

	// a page: always live; the offline page only when the network can't be reached
	event.respondWith(
		fetch(req).catch(async () => {
			const offline = await caches.match(OFFLINE);
			return offline ?? Response.error();
		})
	);
});
