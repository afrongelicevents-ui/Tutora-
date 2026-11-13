import type { Actions, PageServerLoad } from './$types';
import { eq } from 'drizzle-orm';
import { requireRole } from '#lib/server/guards.ts';
import { myTutors } from '#lib/server/student-tutors.ts';
import { activeParents, familyOf } from '#lib/server/family.ts';
import { notifyUser } from '#lib/server/notify.ts';
import { hitLimit } from '#lib/server/rate-limit.ts';
import { shortName } from '#lib/names.ts';
import { user } from '#lib/server/db/auth.schema.ts';
import { m } from '#lib/paraglide/messages.js';

/** "Talk to someone": message a tutor, or ask a parent to talk. Never a diagnosis. */
export const load: PageServerLoad = async ({ locals, url }) => {
	const u = requireRole(locals.user, url, ['student']);
	const [tutors, family] = await Promise.all([
		myTutors(locals.db, u.id),
		familyOf(locals.db, u.id)
	]);
	return {
		tutors: tutors.map((t) => ({ id: t.tutorId, name: t.name })),
		family: family.filter((f) => f.status === 'active').map((f) => f.label || shortName(f.name))
	};
};

export const actions: Actions = {
	parent: async ({ locals, url }) => {
		const u = requireRole(locals.user, url, ['student']);
		if (!(await hitLimit(locals.db, 'talkParent', u.id)).ok) return { asked: true };
		const [me] = await locals.db.select({ name: user.name }).from(user).where(eq(user.id, u.id));
		const name = shortName(me?.name ?? '');
		for (const p of await activeParents(locals.db, u.id))
			await notifyUser(locals.db, p, m.tk_notify_s({ name }), m.tk_notify_b({ name }), {
				kind: 'family',
				link: `/parent?child=${encodeURIComponent(u.id)}`
			});
		return { asked: true };
	}
};
