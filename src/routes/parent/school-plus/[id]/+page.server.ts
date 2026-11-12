import { error, fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { parentAccess } from '#lib/server/family.ts';
import { logOf, PartnershipFail, stopPartnership } from '#lib/server/partnership.ts';
import { partnership } from '#lib/server/db/v3.schema.ts';
import { notifyTutor } from '#lib/server/notify.ts';
import { m } from '#lib/paraglide/messages.js';

/** One partnership: the signed consent, the status and the full message log. */
export const load: PageServerLoad = async ({ locals, url, params }) => {
	const u = requireRole(locals.user, url, ['parent']);
	const [p] = await locals.db
		.select()
		.from(partnership)
		.where(and(eq(partnership.id, Number(params.id) || 0), eq(partnership.parentId, u.id)));
	// only while still connected to the child
	if (!p || !(await parentAccess(locals.db, u.id, p.studentId)).ok) error(404, 'Not found');
	const { schoolTokenHash: _t, ...rest } = p;
	return { p: rest, log: await logOf(locals.db, p.id) };
};

export const actions: Actions = {
	stop: async ({ locals, url, params }) => {
		const u = requireRole(locals.user, url, ['parent']);
		try {
			const p = await stopPartnership(locals.db, u.id, Number(params.id) || 0);
			await notifyTutor(
				locals.db,
				p.tutorId,
				m.sp3_n_stopped_s(),
				m.sp3_n_stopped_b({ subject: p.subject }),
				{ kind: 'family', link: '/tutor/school-plus' }
			);
		} catch (e) {
			if (e instanceof PartnershipFail) return fail(400, { error: e.code });
			throw e;
		}
		return { stopped: true };
	}
};
