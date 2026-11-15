import type { LayoutServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';

// Schoolteachers only (accounts made through a School+ invite). They see the partnerships
// they accepted and nothing else; every page checks that again.
export const load: LayoutServerLoad = ({ locals, url }) => {
	requireRole(locals.user, url, ['schoolteacher']);
};
