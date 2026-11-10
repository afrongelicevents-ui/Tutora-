import type { LayoutServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';

// Students and parents only. Each person will only ever see their own records (enforced in queries).
export const load: LayoutServerLoad = ({ locals, url }) => {
	requireRole(locals.user, url, ['student', 'parent']);
};
