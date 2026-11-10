import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireUser } from '#lib/server/guards.ts';
import { homeFor } from '#lib/roles.ts';

export const load: PageServerLoad = ({ locals, url }) => {
	const user = requireUser(locals.user, url);
	// After logging in, send each person to their own area (the tutor must have 2FA on first).
	if (url.searchParams.has('welcome')) {
		if (user.role === 'tutor' && !user.twoFactorEnabled) redirect(303, '/account/2fa?required=1');
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
