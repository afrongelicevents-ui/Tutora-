import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireUser } from '#lib/server/guards.ts';
import { homeFor } from '#lib/roles.ts';

export const load: PageServerLoad = ({ locals, url }) => {
	const user = requireUser(locals.user, url);
	// After logging in, send each person to their own area: tutor dashboard, student area or
	// owner admin. Tutors waiting for approval see their status; tutors and the owner switch on
	// the authenticator app first.
	if (url.searchParams.has('welcome')) {
		if (user.role === 'tutor' && user.tutorStatus === 'suspended') redirect(303, '/tutor-status');
		if ((user.role === 'tutor' || user.role === 'owner') && !user.twoFactorEnabled)
			redirect(303, '/account/2fa?required=1');
		redirect(303, homeFor(user.role));
	}
	return {
		account: {
			name: user.name,
			email: user.email,
			role: user.role,
			twoFactorEnabled: user.twoFactorEnabled
		}
	};
};
