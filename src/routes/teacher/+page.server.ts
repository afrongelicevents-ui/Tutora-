import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { forTeacher } from '#lib/server/partnership.ts';
import { shortName } from '#lib/names.ts';

/** The partnerships this teacher accepted (usually one: then it opens straight away). */
export const load: PageServerLoad = async ({ locals, url }) => {
	const me = requireRole(locals.user, url, ['schoolteacher']);
	const rows = await forTeacher(locals.db, me.id);
	const open = rows.filter((r) => r.p.status === 'active' || r.p.status === 'teacher_accepted');
	if (open.length === 1 && rows.length === 1) redirect(303, `/teacher/p/${open[0].p.id}`);
	return {
		items: rows.map((r) => ({
			id: r.p.id,
			child: shortName(r.child),
			subject: r.p.subject,
			school: r.p.schoolName,
			tutor: r.tutor ?? '',
			status: r.p.status
		}))
	};
};
