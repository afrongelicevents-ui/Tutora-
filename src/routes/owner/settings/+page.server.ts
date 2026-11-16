import { fail, isActionFailure } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { TEST_PASSWORD, TEST_SITE } from '$app/env/private';
import { audit } from '#lib/server/owner.ts';
import { requireOwner } from '#lib/server/guards.ts';
import { accountActions } from '#lib/server/sections.ts';
import { emailEnabled } from '#lib/server/auth.ts';
import { seedTestData } from '#lib/server/seed.ts';
import { formObject } from '#lib/validation/auth.ts';
import { doneFrom, doneRedirect } from '../done.ts';
import { getTutoraSettings } from '#lib/server/family-billing.ts';
import { ownerFamilyActions } from '#lib/server/family-owner.ts';

/**
 * System → Settings: the owner's own login email and password, two-step login, Tutora payment
 * details (Tutora Family) and the test data.
 */
export const load: PageServerLoad = async ({ locals, url }) => {
	const u = requireOwner(locals.user, url);
	return {
		email: u.email,
		emailOn: emailEnabled,
		testSite: TEST_SITE === '1',
		// Tutora payment details (how families pay for Tutora Family), discounts, pilot trial
		familySettings: await getTutoraSettings(locals.db),
		done: doneFrom(url)
	};
};

// every change to the owner's own sign-in is written to the audit log (never the values)
const base = accountActions();
export const actions: Actions = {
	familySettings: ownerFamilyActions().familySettings,
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
	},
	resetTest: async ({ locals, url, request }) => {
		const me = requireOwner(locals.user, url);
		// only ever on the test site
		if (TEST_SITE !== '1') return fail(404, { error: 'err_not_found' });
		if (formObject(await request.formData()).sure !== 'on')
			return fail(400, { error: 'err_tick_sure' });
		await seedTestData(locals.db, locals.auth, { testSite: true, password: TEST_PASSWORD });
		await audit(locals.db, me.id, 'test_site_reset', null);
		doneRedirect(url, 'owner_done_reset');
	}
};
