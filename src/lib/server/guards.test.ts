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

describe('central lock for private areas (also page-data requests)', () => {
	const student = { id: 's', role: 'student', emailVerified: true };
	const tutorNo2fa = { id: 't', role: 'tutor', emailVerified: true, twoFactorEnabled: false };
	const tutor = { ...tutorNo2fa, twoFactorEnabled: true };
	it('blocks visitors and students from tutor data, including __data.json', async () => {
		const { areaAccess } = await import('./guards.ts');
		expect(
			areaAccess('/tutor/students/__data.json', '?x-sveltekit-invalidated=001', undefined)
		).toEqual({
			ok: false,
			status: 303,
			location: '/login?next=%2Ftutor%2Fstudents'
		});
		expect(areaAccess('/tutor/students/abc/__data.json', '', student)).toEqual({
			ok: false,
			status: 403
		});
		expect(areaAccess('/tutor', '', tutorNo2fa)).toMatchObject({
			ok: false,
			location: '/account/2fa?required=1'
		});
		expect(areaAccess('/tutor/payments/export', '', tutor)).toEqual({ ok: true });
	});
	it('student area is for students and parents only', async () => {
		const { areaAccess } = await import('./guards.ts');
		expect(areaAccess('/student/__data.json', '', tutor)).toEqual({ ok: false, status: 403 });
		expect(areaAccess('/student/payments', '', { ...student, role: 'parent' })).toEqual({
			ok: true
		});
		expect(areaAccess('/students-of-the-month', '', undefined)).toEqual({ ok: true });
		expect(areaAccess('/tutorial', '', undefined)).toEqual({ ok: true });
	});
});
