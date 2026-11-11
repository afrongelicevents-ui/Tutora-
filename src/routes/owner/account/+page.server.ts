import type { Actions, PageServerLoad } from './$types';
import { requireOwner } from '#lib/server/guards.ts';
import { accountActions } from '#lib/server/sections.ts';
import { emailEnabled } from '#lib/server/auth.ts';

export const load: PageServerLoad = ({ locals, url }) => {
	const u = requireOwner(locals.user, url);
	return { email: u.email, emailOn: emailEnabled };
};

export const actions: Actions = accountActions();
