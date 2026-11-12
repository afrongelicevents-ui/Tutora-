/** Who may connect which tool: checked on the server for every Connected Tools request. */
import { error } from '@sveltejs/kit';
import type { DB } from '../db/types.ts';
import type { Provider } from '../db/v3.schema.ts';
import { requireRole, requireTutor, type GuardUser } from '../guards.ts';
import { toolsAllowedFor } from '../family.ts';
import { providerAllowed, type ToolRole } from './oauth.ts';

/** Tutors (approved, 2FA) and students only. */
export function requireToolUser<U extends GuardUser>(user: U | undefined, url: URL) {
	const u = requireRole(user, url, ['tutor', 'student']);
	if (u.role === 'tutor') return { user: requireTutor(u, url), role: 'tutor' as ToolRole };
	return { user: u, role: 'student' as ToolRole };
}

export const toolsPagePath = (role: ToolRole) =>
	role === 'tutor' ? '/tutor/tools' : '/student/tools';

/**
 * Null when this person may connect the provider, otherwise the reason (a message key).
 * Students under 18 need their guardian's permission for outside tools.
 */
export async function connectBlocked(
	db: DB,
	role: ToolRole,
	userId: string,
	p: Provider
): Promise<string | null> {
	if (!providerAllowed(role, p)) return 'tools6_err_not_for_you';
	if (role === 'student' && !(await toolsAllowedFor(db, userId))) return 'tools6_err_guardian';
	return null;
}

export function providerParam(p: string): Provider {
	if (p !== 'google' && p !== 'microsoft') error(404, 'Not found');
	return p;
}
