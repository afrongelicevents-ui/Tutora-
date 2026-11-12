export const ROLES = ['owner', 'tutor', 'student', 'parent'] as const;
export type Role = (typeof ROLES)[number];

/**
 * Account types made by the server's sign-up code. The public sign-up page only makes
 * students; parents are only made through Family Connection (a child's invite code).
 * `tutor` is never self-selected (tutors join at /join and wait for approval).
 */
export const SIGNUP_ROLES = ['student', 'parent'] as const satisfies readonly Role[];
export type SignupRole = (typeof SIGNUP_ROLES)[number];

export function isRole(value: unknown): value is Role {
	return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/** Where each role lands after logging in. */
export function homeFor(role: Role): '/owner' | '/tutor' | '/student' | '/parent' {
	if (role === 'owner') return '/owner';
	if (role === 'parent') return '/parent';
	return role === 'tutor' ? '/tutor' : '/student';
}
