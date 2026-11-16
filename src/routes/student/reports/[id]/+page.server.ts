import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { forStudent, sentReport, tutorNames } from '#lib/server/reports.ts';

/** One of MY reports from a tutor: the figures, and the note only if the tutor showed it to me. */
export const load: PageServerLoad = async ({ locals, url, params }) => {
	const u = requireRole(locals.user, url, ['student']);
	const r = await sentReport(locals.db, u.id, Number(params.id) || 0);
	if (!r) error(404, 'Not found');
	const names = await tutorNames(locals.db, [r.tutorId]);
	const s = forStudent(r);
	return {
		report: {
			id: s.id,
			tutor: names.get(r.tutorId) ?? '',
			periodStart: s.periodStart,
			periodEnd: s.periodEnd,
			sentAt: s.sentAt,
			figures: s.figures,
			note: s.note
		}
	};
};
