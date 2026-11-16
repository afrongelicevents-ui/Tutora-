/**
 * The Content-Security-Policy directives. SvelteKit sends the header (see `csp` in
 * vite.config.ts, which uses these) so it can hash its own inline scripts.
 */
export const CSP_DIRECTIVES = {
	'default-src': ['self'],
	'script-src': ['self'],
	'style-src': ['self', 'unsafe-inline'],
	'img-src': ['self', 'data:', 'blob:'],
	'font-src': ['self'],
	'connect-src': ['self'],
	'frame-src': ['none'],
	'media-src': ['self', 'blob:'],
	'frame-ancestors': ['none'],
	'form-action': ['self'],
	'base-uri': ['self'],
	'object-src': ['none'],
	'upgrade-insecure-requests': true
} as const;

type Mutable<T> = { -readonly [K in keyof T]: T[K] extends readonly (infer U)[] ? U[] : T[K] };

/** A fresh, mutable copy of the directives, in the shape SvelteKit's `csp.directives` takes. */
export function cspDirectives(): Mutable<typeof CSP_DIRECTIVES> {
	return Object.fromEntries(
		Object.entries(CSP_DIRECTIVES).map(([k, v]) => [k, Array.isArray(v) ? [...v] : v])
	) as Mutable<typeof CSP_DIRECTIVES>;
}

/**
 * Security headers added to every response. The Content-Security-Policy is set by
 * SvelteKit (see `csp` in vite.config.ts) so it can hash its own inline scripts.
 */
export function securityHeaders({ dev }: { dev: boolean }): Record<string, string> {
	const headers: Record<string, string> = {
		'x-content-type-options': 'nosniff',
		'x-frame-options': 'DENY',
		'referrer-policy': 'strict-origin-when-cross-origin',
		// camera and microphone are allowed for this site only (lesson room, phase 5)
		'permissions-policy':
			'camera=(self), microphone=(self), display-capture=(self), geolocation=(), payment=(), usb=(), interest-cohort=()',
		// Google's sign-in popup (Drive file picker) must be able to answer this window;
		// other sites still cannot reach it.
		'cross-origin-opener-policy': 'same-origin-allow-popups',
		'cross-origin-resource-policy': 'same-origin'
	};
	if (!dev) headers['strict-transport-security'] = 'max-age=63072000; includeSubDomains; preload';
	return headers;
}

/**
 * Browsers only ever need these two Better Auth links (from emails). Everything else
 * (sign-up, sign-in, 2FA, ...) goes through our own form actions, which add validation,
 * rate limits and role rules. Blocking the rest stops people skipping those checks.
 */
export function isAllowedAuthPath(method: string, pathname: string): boolean {
	if (method !== 'GET') return false;
	return (
		pathname === '/api/auth/verify-email' || /^\/api\/auth\/reset-password\/[\w-]+$/.test(pathname)
	);
}
