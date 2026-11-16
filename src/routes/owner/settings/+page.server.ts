import { fail, isActionFailure } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { TEST_PASSWORD, TEST_SITE } from '$app/env/private';
import { audit } from '#lib/server/owner.ts';
import { requireOwner } from '#lib/server/guards.ts';
import { accountActions } from '#lib/server/sections.ts';
import { emailEnabled } from '#lib/server/auth.ts';
import { seedTestData } from '#lib/server/seed.ts';
import { formObject } from '#lib/validation/auth.ts';
import { setFlag } from '#lib/server/flags.ts';
import { doneFrom, doneRedirect } from '../done.ts';
import { getTutoraSettings } from '#lib/server/family-billing.ts';
import { ownerFamilyActions } from '#lib/server/family-owner.ts';
import { ownerGiftsLoad, ownerProActions } from '#lib/server/pro-owner.ts';

/**
 * System → Settings: the owner's own login email and password, two-step login, Tutora payment
 * details (Tutora Family), the Tutora Pro switch, free plans for chosen people and the test data.
 */
export const load: PageServerLoad = async (event) => {
	const { locals, url } = event;
	const u = requireOwner(locals.user, url);
	return {
		...(await ownerGiftsLoad(event)),
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
const pro = ownerProActions();
export const actions: Actions = {
	familySettings: ownerFamilyActions().familySettings,
	proSettings: pro.proSettings,
	giftGive: pro.giftGive,
	giftRemove: pro.giftRemove,
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
	/** Tutora's own (old) video lesson room: off by default (lessons on Teams / Meet / Zoom) */
	videoRoom: async ({ locals, url, request }) => {
		const me = requireOwner(locals.user, url);
		const on = formObject(await request.formData()).on === '1';
		await setFlag(locals.db, 'video_room', on);
		await audit(locals.db, me.id, on ? 'video_room_on' : 'video_room_off', null);
		doneRedirect(url, on ? 'owner_done_room_on' : 'owner_done_room_off');
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
