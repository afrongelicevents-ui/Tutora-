export const ROLES = ['tutor', 'student', 'parent'] as const;
export type Role = (typeof ROLES)[number];

/** Roles a person can pick when signing up. `tutor` is never self-selected. */
export const SIGNUP_ROLES = ['student', 'parent'] as const satisfies readonly Role[];
export type SignupRole = (typeof SIGNUP_ROLES)[number];

export function isRole(value: unknown): value is Role {
	return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/** Where each role lands after logging in. */
export function homeFor(role: Role): '/tutor' | '/student' {
	return role === 'tutor' ? '/tutor' : '/student';
}
