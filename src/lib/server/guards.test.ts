import { describe, expect, it } from 'vitest';
import { isHttpError, isRedirect } from '@sveltejs/kit';
import { requireOwner, requireRole, requireTutor, requireUser, safeNext } from './guards.ts';

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
		const ok = requireTutor(
			{ ...base, role: 'tutor', twoFactorEnabled: true, tutorStatus: 'active' },
			url
		);
		expect(ok.role).toBe('tutor');
	});

	it('lets tutors fill in their profile before approval, but keeps suspended tutors out', () => {
		for (const tutorStatus of ['draft', 'pending', 'rejected'] as const)
			expect(
				requireTutor({ ...base, role: 'tutor', twoFactorEnabled: true, tutorStatus }, url).role
			).toBe('tutor');
		for (const tutorStatus of ['suspended', null] as const) {
			const e = thrown(() =>
				requireTutor({ ...base, role: 'tutor', twoFactorEnabled: true, tutorStatus }, url)
			);
			expect(isRedirect(e) && e.location).toBe('/tutor-status');
		}
	});

	it('the owner area is only for the owner, with 2FA', () => {
		for (const role of ['tutor', 'student', 'parent']) {
			const e = thrown(() => requireOwner({ ...base, role, twoFactorEnabled: true }, url));
			expect(isHttpError(e) && e.status).toBe(403);
		}
		const e = thrown(() => requireOwner({ ...base, role: 'owner' }, url));
		expect(isRedirect(e) && e.location).toBe('/account/2fa?required=1');
		expect(requireOwner({ ...base, role: 'owner', twoFactorEnabled: true }, url).role).toBe(
			'owner'
		);
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
	const tutor = { ...tutorNo2fa, twoFactorEnabled: true, tutorStatus: 'active' as const };
	const owner = { id: 'o', role: 'owner', emailVerified: true, twoFactorEnabled: true };
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
			status: 403,
			area: 'tutor'
		});
		expect(areaAccess('/tutor', '', owner)).toMatchObject({ ok: false, status: 403 });
		expect(areaAccess('/tutor', '', { ...tutor, tutorStatus: 'pending' as const })).toEqual({
			ok: true
		});
		expect(areaAccess('/tutor', '', { ...tutor, tutorStatus: 'suspended' as const })).toEqual({
			ok: false,
			status: 303,
			location: '/tutor-status'
		});
		expect(areaAccess('/tutor', '', tutorNo2fa)).toMatchObject({
			ok: false,
			location: '/account/2fa?required=1'
		});
		expect(areaAccess('/tutor/payments/export', '', tutor)).toEqual({ ok: true });
	});
	it('each role sees only its own area (v3: parents have /parent)', async () => {
		const { areaAccess } = await import('./guards.ts');
		expect(areaAccess('/student/__data.json', '', tutor)).toEqual({
			ok: false,
			status: 403,
			area: 'student'
		});
		expect(areaAccess('/student/payments', '', { ...student, role: 'parent' })).toEqual({
			ok: false,
			status: 303,
			location: '/parent'
		});
		expect(areaAccess('/student', '', student)).toEqual({ ok: true });
		expect(areaAccess('/parent', '', { ...student, role: 'parent' })).toEqual({ ok: true });
		expect(areaAccess('/parent/__data.json', '', student)).toEqual({
			ok: false,
			status: 403,
			area: 'parent'
		});
		expect(areaAccess('/parent/updates', '', tutor)).toMatchObject({ ok: false, status: 403 });
		expect(areaAccess('/parent', '', undefined)).toMatchObject({ status: 303 });
		expect(areaAccess('/parents-evening', '', undefined)).toEqual({ ok: true });
		expect(areaAccess('/students-of-the-month', '', undefined)).toEqual({ ok: true });
		expect(areaAccess('/tutorial', '', undefined)).toEqual({ ok: true });
	});
	it('owner area is for the owner only', async () => {
		const { areaAccess } = await import('./guards.ts');
		expect(areaAccess('/owner', '', owner)).toEqual({ ok: true });
		expect(areaAccess('/owner/__data.json', '', tutor)).toEqual({
			ok: false,
			status: 403,
			area: 'owner'
		});
		expect(areaAccess('/owner', '', { ...owner, twoFactorEnabled: false })).toMatchObject({
			location: '/account/2fa?required=1'
		});
		expect(areaAccess('/owner', '', undefined)).toMatchObject({ status: 303 });
		expect(areaAccess('/ownership-faq', '', undefined)).toEqual({ ok: true });
		// encoded paths are decoded first, like the router does
		expect(areaAccess('/%74utor/students', '', student)).toMatchObject({ ok: false, status: 403 });
		expect(areaAccess('/%6Fwner', '', tutor)).toMatchObject({ ok: false, status: 403 });
		expect(areaAccess('/%E0%A4%A', '', undefined)).toMatchObject({ ok: false });
	});
});
