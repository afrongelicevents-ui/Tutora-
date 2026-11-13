import type { PageServerLoad } from './$types';
import { and, eq } from 'drizzle-orm';
import { requireRole } from '#lib/server/guards.ts';
import { conversations, type Conversation } from '#lib/server/messages.ts';
import { enrollment } from '#lib/server/db/app.schema.ts';
import { user } from '#lib/server/db/auth.schema.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	const t = requireRole(locals.user, url, ['tutor']).id;
	const [convs, students] = await Promise.all([
		conversations(locals.db, t, 'tutor'),
		locals.db
			.select({ id: user.id, name: user.name })
			.from(enrollment)
			.innerJoin(user, eq(user.id, enrollment.userId))
			.where(and(eq(enrollment.tutorId, t), eq(user.role, 'student')))
	]);
	const start = students.filter(
		(s: { id: string; name: string }) => !convs.some((c: Conversation) => c.otherId === s.id)
	);
	return { convs, start };
};
