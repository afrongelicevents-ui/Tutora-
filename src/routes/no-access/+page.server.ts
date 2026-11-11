import type { PageServerLoad } from './$types';
import { homeFor } from '#lib/roles.ts';

/** Friendly page for anyone who opened a page that isn't for them. */
export const load: PageServerLoad = ({ locals, url }) => {
	const area = url.searchParams.get('for');
	return {
		area: area === 'tutor' || area === 'owner' || area === 'student' ? area : null,
		loggedIn: !!locals.user,
		home: locals.user ? homeFor(locals.user.role) : '/'
	};
};
