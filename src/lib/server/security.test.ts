import { describe, expect, it } from 'vitest';
import { CSP_DIRECTIVES, cspDirectives, isAllowedAuthPath, securityHeaders } from './security.ts';

describe('security headers', () => {
	it('sends HSTS in production only', () => {
		expect(securityHeaders({ dev: false })['strict-transport-security']).toContain(
			'max-age=63072000'
		);
		expect(securityHeaders({ dev: true })['strict-transport-security']).toBeUndefined();
	});
	it('blocks framing and MIME sniffing', () => {
		const h = securityHeaders({ dev: false });
		expect(h['x-frame-options']).toBe('DENY');
		expect(h['x-content-type-options']).toBe('nosniff');
	});
});

describe('content security policy', () => {
	it('stays strict: own scripts, no plugins, no framing of this site, forms only to itself', () => {
		expect(CSP_DIRECTIVES['default-src']).toEqual(['self']);
		expect(CSP_DIRECTIVES['object-src']).toEqual(['none']);
		expect(CSP_DIRECTIVES['frame-ancestors']).toEqual(['none']);
		expect(CSP_DIRECTIVES['form-action']).toEqual(['self']);
		expect(CSP_DIRECTIVES['base-uri']).toEqual(['self']);
		expect(CSP_DIRECTIVES['script-src']).not.toContain('unsafe-inline');
		expect(CSP_DIRECTIVES['script-src']).not.toContain('unsafe-eval');
	});
	it('allows exactly what the Google Drive picker needs', () => {
		expect(CSP_DIRECTIVES['script-src']).toEqual([
			'self',
			'https://accounts.google.com/gsi/client',
			'https://apis.google.com'
		]);
		expect(CSP_DIRECTIVES['frame-src']).toEqual([
			'https://accounts.google.com',
			'https://docs.google.com',
			'https://drive.google.com'
		]);
		expect(CSP_DIRECTIVES['connect-src']).toEqual(['self', 'https://accounts.google.com/gsi/']);
		// no wildcards anywhere
		expect(JSON.stringify(CSP_DIRECTIVES)).not.toContain('*');
	});
	it('gives SvelteKit a fresh copy each time', () => {
		const a = cspDirectives();
		a['script-src'].push('unsafe-eval' as never);
		expect(cspDirectives()).toEqual(CSP_DIRECTIVES);
	});
	it('lets the Google sign-in popup answer, and nothing more', () => {
		expect(securityHeaders({ dev: false })['cross-origin-opener-policy']).toBe(
			'same-origin-allow-popups'
		);
	});
});

describe('direct Better Auth endpoints are blocked', () => {
	it('allows only the two links sent by email', () => {
		expect(isAllowedAuthPath('GET', '/api/auth/verify-email')).toBe(true);
		expect(isAllowedAuthPath('GET', '/api/auth/reset-password/abcDEF123_-')).toBe(true);
	});
	it('blocks sign-up, sign-in, 2FA changes and profile updates', () => {
		for (const [m, p] of [
			['POST', '/api/auth/sign-up/email'],
			['POST', '/api/auth/sign-in/email'],
			['POST', '/api/auth/two-factor/disable'],
			['POST', '/api/auth/update-user'],
			['GET', '/api/auth/get-session'],
			['POST', '/api/auth/verify-email'],
			['GET', '/api/auth/reset-password/x/../../sign-up']
		]) {
			expect(isAllowedAuthPath(m, p), `${m} ${p}`).toBe(false);
		}
	});
});
