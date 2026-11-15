/**
 * Public pages (homepage, tutor pages, terms…) for people who are not logged in, kept in the
 * worker's memory for a minute. The Cloudflare edge cache does not work on *.workers.dev,
 * so this is the free way to serve repeat visits without rendering and without the database.
 * See docs/FREE-LIMITS.md.
 *
 * Safe because: only GET, only when the visitor sends no login cookie, only these public
 * paths, never a response that sets a cookie, and the page's security policy uses hashes
 * (not per-response nonces). Any form sent to this worker clears it, so a change made here
 * shows at once; other workers show it within a minute.
 */
const TTL_MS = 60_000;
const MAX = 120;
const PUBLIC =
	/^\/(?:|tutors|join|terms|privacy|contact|get-started|t\/[a-z0-9-]+(?:\/(?:reviews|subjects|about|results))?)(?:\/__data\.json)?$/;

interface Entry {
	until: number;
	status: number;
	headers: [string, string][];
	body: ArrayBuffer;
}
const pages = new Map<string, Entry>();

const loggedIn = (cookie: string | null) => !!cookie && /session_token|session_data/.test(cookie);

export function cacheKey(request: Request, url: URL): string | null {
	if (request.method !== 'GET') return null;
	if (loggedIn(request.headers.get('cookie'))) return null;
	if (!PUBLIC.test(url.pathname)) return null;
	return url.pathname + url.search;
}

export function cachedPage(key: string): Response | null {
	const e = pages.get(key);
	if (!e) return null;
	if (e.until < Date.now()) {
		pages.delete(key);
		return null;
	}
	const res = new Response(e.body.slice(0), { status: e.status, headers: e.headers });
	res.headers.set('x-tutora-cache', 'hit');
	return res;
}

/** Keeps a copy of a public page; returns the response to send now. */
export async function keepPage(key: string, res: Response): Promise<Response> {
	const type = res.headers.get('content-type') ?? '';
	if (
		res.status !== 200 ||
		res.headers.has('set-cookie') ||
		!(type.startsWith('text/html') || type.startsWith('application/json'))
	)
		return res;
	const body = await res.arrayBuffer();
	const headers = [...res.headers.entries()];
	if (pages.size >= MAX) pages.delete(pages.keys().next().value!);
	pages.set(key, { until: Date.now() + TTL_MS, status: res.status, headers, body });
	return new Response(body, { status: res.status, headers });
}

export function forgetPages() {
	pages.clear();
}
