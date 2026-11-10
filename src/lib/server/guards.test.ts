import { describe, expect, it } from 'vitest';
import { isHttpError, isRedirect } from '@sveltejs/kit';
import { requireRole, requireTutor, requireUser, safeNext } from './guards.ts';

const url = new URL('http://localhost/tutor/payments?x=1');
const base = { id: 'u1', emailVerified: true, twoFactorEnabled: false };

function thrown(fn: () => unknown) {
	try {
		fn();
	} catch (e) {
		return e;
	}
	throw new Error('expected to throw');
}

describe('role guards (server-side permissions)', () => {
	it('sends visitors to login and back', () => {
		const e = thrown(() => requireUser(undefined, url));
		expect(isRedirect(e) && e.location).toBe('/login?next=%2Ftutor%2Fpayments%3Fx%3D1');
	});

	it('blocks students and parents from tutor pages', () => {
		for (const role of ['student', 'parent']) {
			const e = thrown(() => requireTutor({ ...base, role }, url));
			expect(isHttpError(e) && e.status).toBe(403);
		}
	});

	it('blocks the tutor from student pages', () => {
		const e = thrown(() => requireRole({ ...base, role: 'tutor' }, url, ['student', 'parent']));
		expect(isHttpError(e) && e.status).toBe(403);
	});

	it('blocks users with a missing or unknown role', () => {
		expect(isHttpError(thrown(() => requireRole({ ...base, role: null }, url, ['student'])))).toBe(
			true
		);
		expect(isHttpError(thrown(() => requireRole({ ...base, role: 'admin' }, url, ['tutor'])))).toBe(
			true
		);
	});

	it('makes the tutor turn on 2FA before entering the tutor area', () => {
		const e = thrown(() => requireTutor({ ...base, role: 'tutor' }, url));
		expect(isRedirect(e) && e.location).toBe('/account/2fa?required=1');
		const ok = requireTutor({ ...base, role: 'tutor', twoFactorEnabled: true }, url);
		expect(ok.role).toBe('tutor');
	});

	it('lets students and parents into the student area', () => {
		expect(requireRole({ ...base, role: 'parent' }, url, ['student', 'parent']).role).toBe(
			'parent'
		);
	});
});

describe('safeNext', () => {
	it('only allows paths on this site', () => {
		expect(safeNext('/student', '/')).toBe('/student');
		expect(safeNext('https://evil.example', '/')).toBe('/');
		expect(safeNext('//evil.example', '/')).toBe('/');
		expect(safeNext('/\\evil.example', '/')).toBe('/');
		expect(safeNext(null, '/x')).toBe('/x');
		// browsers drop tabs/newlines: "/\t/evil.com" would become "//evil.com"
		expect(safeNext('/\t/evil.example', '/')).toBe('/');
		expect(safeNext('/\n/evil.example', '/')).toBe('/');
		expect(safeNext('/%09/evil.example', '/')).toBe('/%09/evil.example');
		expect(safeNext('/student?tab=pay#x', '/')).toBe('/student?tab=pay#x');
	});
});
