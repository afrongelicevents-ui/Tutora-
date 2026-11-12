import type { LayoutServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';

// Students only (parents have their own area). Each student only ever sees their own records.
export const load: LayoutServerLoad = ({ locals, url }) => {
	requireRole(locals.user, url, ['student']);
};
