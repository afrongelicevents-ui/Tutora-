import { TEST_SITE } from '$app/env/private';
import type { LayoutServerLoad } from './$types';
import { BELL_PAGE, unreadCount } from '#lib/server/notify.ts';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	return {
		user: locals.user ? { name: locals.user.name, role: locals.user.role } : null,
		// on the bell page the newest ones are being marked read: the count is already without them
		unread: locals.user
			? await unreadCount(
					locals.db,
					locals.user.id,
					url.pathname === '/notifications' ? BELL_PAGE : 0
				)
			: 0,
		/** the test site shows a "TEST SITE — fake data" bar on every page */
		testSite: TEST_SITE === '1'
	};
};
