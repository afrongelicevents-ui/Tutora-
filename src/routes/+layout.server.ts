import { TEST_SITE } from '$app/env/private';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		user: locals.user ? { name: locals.user.name, role: locals.user.role } : null,
		/** the test site shows a "TEST SITE — fake data" bar on every page */
		testSite: TEST_SITE === '1'
	};
};
