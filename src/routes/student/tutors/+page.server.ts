import type { PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { myTutors } from '#lib/server/student-tutors.ts';
import { conversations } from '#lib/server/messages.ts';

/** The Tutors tab: my tutors, messages and what tutors can help with. */
export const load: PageServerLoad = async ({ locals, url }) => {
	const s = requireRole(locals.user, url, ['student']).id;
	const [tutors, convs] = await Promise.all([
		myTutors(locals.db, s),
		conversations(locals.db, s, 'student')
	]);
	return { tutors, messages: convs.slice(0, 3) };
};
