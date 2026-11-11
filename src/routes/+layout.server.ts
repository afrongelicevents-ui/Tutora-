import { TEST_SITE } from '$app/env/private';
import type { LayoutServerLoad } from './$types';
import { unreadCount } from '#lib/server/notify.ts';

export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		user: locals.user ? { name: locals.user.name, role: locals.user.role } : null,
		unread: locals.user ? await unreadCount(locals.db, locals.user.id) : 0,
		/** the test site shows a "TEST SITE — fake data" bar on every page */
		testSite: TEST_SITE === '1'
	};
};
