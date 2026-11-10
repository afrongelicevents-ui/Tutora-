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
		'cross-origin-opener-policy': 'same-origin',
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
