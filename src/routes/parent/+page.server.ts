import type { PageServerLoad } from './$types';
import { previewInvite } from '#lib/server/family.ts';
import { rememberedCode } from '#lib/server/family-code.ts';
import { requireRole } from '#lib/server/guards.ts';
import { childOverview } from '#lib/server/parent.ts';
import { pickChild } from '#lib/server/parent-child.ts';
import { shortName } from '#lib/names.ts';

export const load: PageServerLoad = async ({ locals, url, cookies }) => {
	const u = requireRole(locals.user, url, ['parent']);
	const { kids, current } = await pickChild(locals.db, u.id, url, cookies);
	const code = await rememberedCode(cookies);
	const waiting = code ? await previewInvite(locals.db, code) : null;
	return {
		name: shortName(u.name),
		kids,
		current,
		child: current ? await childOverview(locals.db, u.id, current) : null,
		waitingCode: waiting ? { firstName: waiting.firstName } : null
	};
};
