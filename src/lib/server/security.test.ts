import { describe, expect, it } from 'vitest';
import { isAllowedAuthPath, securityHeaders } from './security.ts';

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
