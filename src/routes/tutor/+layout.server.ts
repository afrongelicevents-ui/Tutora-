import type { LayoutServerLoad } from './$types';
import { requireTutor } from '#lib/server/guards.ts';

// Every page under /tutor: tutor role and two-step verification, checked on the server.
export const load: LayoutServerLoad = ({ locals, url }) => {
	requireTutor(locals.user, url);
};
