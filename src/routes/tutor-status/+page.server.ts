import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';

/** Where a tutor lands while their account waits for approval (or is suspended). */
export const load: PageServerLoad = ({ locals, url }) => {
	const u = requireRole(locals.user, url, ['tutor']);
	if (u.tutorStatus && u.tutorStatus !== 'suspended') redirect(303, '/tutor');
	return { status: u.tutorStatus ?? 'pending', twoFactor: u.twoFactorEnabled };
};
