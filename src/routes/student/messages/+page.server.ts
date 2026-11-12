import type { PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { conversations } from '#lib/server/messages.ts';
import { myTutors } from '#lib/server/student-tutors.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	const s = requireRole(locals.user, url, ['student']).id;
	const [convs, tutors] = await Promise.all([
		conversations(locals.db, s, 'student'),
		myTutors(locals.db, s)
	]);
	// tutors with no conversation yet, to start one
	const start = tutors
		.filter((t) => !convs.some((c) => c.otherId === t.tutorId))
		.map((t) => ({ id: t.tutorId, name: t.name }));
	return { convs, start };
};
