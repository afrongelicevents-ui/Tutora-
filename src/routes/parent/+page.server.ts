import type { PageServerLoad } from './$types';
import { childrenOf, previewInvite } from '#lib/server/family.ts';
import { rememberedCode } from '#lib/server/family-code.ts';
import { requireRole } from '#lib/server/guards.ts';

export const load: PageServerLoad = async ({ locals, url, cookies }) => {
	const u = requireRole(locals.user, url, ['parent']);
	const kids = await childrenOf(locals.db, u.id);
	const code = rememberedCode(cookies);
	const waiting = code ? await previewInvite(locals.db, code) : null;
	return {
		name: u.name,
		kids: kids.map((k) => ({ id: k.studentId, name: k.name, level: k.level, status: k.status })),
		waitingCode: waiting ? { firstName: waiting.firstName } : null
	};
};
