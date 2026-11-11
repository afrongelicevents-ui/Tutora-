import { error } from '@sveltejs/kit';
import { requireTutor } from '#lib/server/guards.ts';
import { emailEnabled } from '#lib/server/auth.ts';
import type { Actions, PageServerLoad } from './$types';
import { isSection, loadSection, sectionActions } from '#lib/server/sections.ts';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	requireTutor(locals.user, url);
	if (!isSection(params.section)) error(404, 'Not found');
	return {
		section: params.section,
		...(await loadSection(locals.db, params.section)),
		email: locals.user!.email,
		emailOn: emailEnabled,
		changed: url.searchParams.has('changed')
	};
};

export const actions: Actions = sectionActions(() => null);
