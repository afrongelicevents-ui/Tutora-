import { isActionFailure } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { audit } from '#lib/server/owner.ts';
import { requireOwner } from '#lib/server/guards.ts';
import { accountActions } from '#lib/server/sections.ts';
import { emailEnabled } from '#lib/server/auth.ts';

export const load: PageServerLoad = ({ locals, url }) => {
	const u = requireOwner(locals.user, url);
	return { email: u.email, emailOn: emailEnabled };
};

// every change to the owner's own sign-in is written to the audit log (never the values)
const base = accountActions();
export const actions: Actions = {
	changeEmail: async (ev) => {
		const r = await base.changeEmail(ev);
		if (!isActionFailure(r) && ev.locals.user)
			await audit(ev.locals.db, ev.locals.user.id, 'owner_email_changed', ev.locals.user.id);
		return r;
	},
	changePassword: async (ev) => {
		const r = await base.changePassword(ev);
		if (!isActionFailure(r) && ev.locals.user)
			await audit(ev.locals.db, ev.locals.user.id, 'owner_password_changed', ev.locals.user.id);
		return r;
	}
};
