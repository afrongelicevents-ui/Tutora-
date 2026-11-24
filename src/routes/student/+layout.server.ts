import type { LayoutServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { familyAccess } from '#lib/server/family-billing.ts';

// Students only (parents have their own area). Each student only ever sees their own records.
export const load: LayoutServerLoad = async ({ locals, url }) => {
	const u = requireRole(locals.user, url, ['student']);
	// on the free level, links to Tutora Family pages get a small "Tutora Family" label
	return { familyActive: (await familyAccess(locals.db, u.id)).active };
};
