import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { requireTutor } from '#lib/server/guards.ts';
import { getSettings } from '#lib/server/settings.ts';

// Every page under /tutor: tutor role and two-step verification, checked on the server.
export const load: LayoutServerLoad = async ({ locals, url }) => {
	const t = requireTutor(locals.user, url).id;
	const s = await getSettings(locals.db, t);
	// First login: start the setup wizard (it can be skipped and finished later).
	if (!s.setupDoneAt && url.pathname === '/tutor') redirect(303, '/tutor/setup/0');
	return { setupDone: !!s.setupDoneAt, setupStep: s.setupStep };
};
