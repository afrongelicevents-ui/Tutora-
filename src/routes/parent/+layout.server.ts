import type { LayoutServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';

// Parents and guardians only. Every page checks again, per child, what that child shares.
export const load: LayoutServerLoad = ({ locals, url }) => {
	const u = requireRole(locals.user, url, ['parent']);
	return { initial: (u.name.trim()[0] ?? '?').toUpperCase() };
};
