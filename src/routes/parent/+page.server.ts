import type { PageServerLoad } from './$types';
import { previewInvite } from '#lib/server/family.ts';
import { rememberedCode } from '#lib/server/family-code.ts';
import { requireRole } from '#lib/server/guards.ts';
import { childOverview } from '#lib/server/parent.ts';
import { pickChild } from '#lib/server/parent-child.ts';
import { shortName } from '#lib/names.ts';
import { readingParents } from '#lib/server/messages.ts';

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
		// the messages link only for a parent who may read them (under 18, guardian first)
		readsMessages: current ? (await readingParents(locals.db, current)).includes(u.id) : false,
		waitingCode: waiting ? { firstName: waiting.firstName } : null
	};
};
