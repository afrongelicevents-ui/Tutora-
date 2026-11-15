import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { previewInvite } from '#lib/server/family.ts';
import { rememberedCode } from '#lib/server/family-code.ts';
import { requireRole } from '#lib/server/guards.ts';
import { pickChild } from '#lib/server/parent-child.ts';
import { childCards, familyMonth, greetingKey } from '#lib/server/parent-home.ts';
import { shortName } from '#lib/names.ts';

export const load: PageServerLoad = async ({ locals, url, cookies }) => {
	const u = requireRole(locals.user, url, ['parent']);
	// older links (notifications, emails) point at /parent?child=…: that child's own page now
	const child = url.searchParams.get('child');
	if (child && !url.searchParams.has('connected') && !url.searchParams.has('pending')) {
		const keep = url.searchParams.has('booked') ? '?booked=1' : '';
		redirect(303, `/parent/child/${encodeURIComponent(child)}${keep}`);
	}
	const { kids } = await pickChild(locals.db, u.id, url, cookies);
	const code = await rememberedCode(cookies);
	const [cards, waiting] = await Promise.all([
		childCards(locals.db, u.id, kids),
		code ? previewInvite(locals.db, code) : Promise.resolve(null)
	]);
	return {
		name: shortName(u.name),
		greeting: greetingKey(),
		cards,
		waiting: kids.filter((k) => k.status !== 'active').map((k) => k.name),
		month: familyMonth(cards),
		waitingCode: waiting ? { firstName: waiting.firstName } : null,
		connected: url.searchParams.get('connected'),
		pending: url.searchParams.get('pending')
	};
};
