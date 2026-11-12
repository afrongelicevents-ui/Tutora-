import { error, redirect } from '@sveltejs/kit';
import type { Role } from '../roles';

export interface GuardUser {
	id: string;
	role?: string | null;
	emailVerified: boolean;
	twoFactorEnabled?: boolean | null;
	tutorStatus?: 'draft' | 'pending' | 'active' | 'rejected' | 'suspended' | null;
}

/** Which private area a path belongs to. */
export type Area = 'owner' | 'tutor' | 'student' | 'parent';
export function areaOf(pathname: string): Area | null {
	for (const a of ['owner', 'tutor', 'student', 'parent'] as const)
		if (pathname === `/${a}` || pathname.startsWith(`/${a}/`)) return a;
	return null;
}

/** Must be logged in. Sends visitors to the login page and back afterwards. */
export function requireUser<U extends GuardUser>(user: U | undefined, url: URL): U {
	if (!user) {
		const next = url.pathname + url.search;
		redirect(303, `/login?next=${encodeURIComponent(next)}`);
	}
	return user;
}

/** Must be logged in with one of the given roles. Checked on the server for every request. */
export function requireRole<U extends GuardUser>(
	user: U | undefined,
	url: URL,
	roles: readonly Role[]
): U & { role: Role } {
	const u = requireUser(user, url);
	if (!u.role || !(roles as readonly string[]).includes(u.role)) {
		error(403, 'no_access');
	}
	return u as U & { role: Role };
}

/**
 * The tutor area: an approved tutor with two-step verification switched on.
 * The returned id is the tutor's id: every query uses it, so a tutor only ever
 * reaches their own students, lessons and money.
 */
export function requireTutor<U extends GuardUser>(user: U | undefined, url: URL) {
	const u = requireRole(user, url, ['tutor']);
	if (!u.twoFactorEnabled) redirect(303, '/account/2fa?required=1');
	// tutors fill in their profile before approval; only suspended tutors are kept out
	if (!u.tutorStatus || u.tutorStatus === 'suspended') redirect(303, '/tutor-status');
	return u;
}

/** The platform owner's area, also with two-step verification. */
export function requireOwner<U extends GuardUser>(user: U | undefined, url: URL) {
	const u = requireRole(user, url, ['owner']);
	if (!u.twoFactorEnabled) redirect(303, '/account/2fa?required=1');
	return u;
}

/**
 * Only allow redirects to paths on this site (prevents open redirects).
 * Resolves the value the way a browser would (browsers ignore tabs and newlines,
 * and treat `\\` like `/`), then checks it stays on our origin.
 */
export function safeNext(next: string | null | undefined, fallback: string): string {
	if (!next || !next.startsWith('/')) return fallback;
	// eslint-disable-next-line no-control-regex
	if (/[\u0000-\u001f\u007f\\]/.test(next)) return fallback;
	const base = 'https://tutora.invalid';
	let url: URL;
	try {
		url = new URL(next, base);
	} catch {
		return fallback;
	}
	if (url.origin !== base) return fallback;
	return url.pathname + url.search + url.hash;
}

export type AreaDecision =
	| { ok: true }
	| { ok: false; status: 303; location: string }
	| { ok: false; status: 403; area: Area };

/**
 * Central lock for the private areas, checked in hooks.server.ts for EVERY request,
 * including SvelteKit's page-data requests (`.../__data.json`). Page loads and form
 * actions check again; this is the outer wall so a forgotten check can't leak data.
 */
export function areaAccess(
	pathname: string,
	search: string,
	user: GuardUser | undefined
): AreaDecision {
	// decide on the decoded path, like the router does ("/%74utor" is "/tutor")
	let decoded: string;
	try {
		decoded = decodeURI(pathname);
	} catch {
		return { ok: false, status: 403, area: 'student' };
	}
	const area = areaOf(decoded) ?? areaOf(pathname);
	if (!area) return { ok: true };
	if (!user) {
		const next =
			pathname.replace(/\/__data\.json$/, '') + search.replace(/[?&]x-sveltekit-[^&]*/g, '');
		return { ok: false, status: 303, location: `/login?next=${encodeURIComponent(next || '/')}` };
	}
	if (area === 'owner') {
		if (user.role !== 'owner') return { ok: false, status: 403, area };
		if (!user.twoFactorEnabled)
			return { ok: false, status: 303, location: '/account/2fa?required=1' };
		return { ok: true };
	}
	if (area === 'tutor') {
		if (user.role !== 'tutor') return { ok: false, status: 403, area };
		if (!user.twoFactorEnabled)
			return { ok: false, status: 303, location: '/account/2fa?required=1' };
		if (!user.tutorStatus || user.tutorStatus === 'suspended')
			return { ok: false, status: 303, location: '/tutor-status' };
		return { ok: true };
	}
	// each role only ever sees its own environment
	if (area === 'parent')
		return user.role === 'parent' ? { ok: true } : { ok: false, status: 403, area };
	if (user.role === 'student') return { ok: true };
	// parents used to share the student area; send them to their own
	if (user.role === 'parent') return { ok: false, status: 303, location: '/parent' };
	return { ok: false, status: 403, area };
}
