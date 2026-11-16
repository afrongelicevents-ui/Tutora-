import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireTutor } from '#lib/server/guards.ts';
import { tutorReport } from '#lib/server/reports.ts';
import { reportResponse } from '#lib/server/report-file.ts';

/** The tutor's own report as a PDF (also drafts, to check before sending). */
export const GET: RequestHandler = async ({ locals, url, params }) => {
	const t = requireTutor(locals.user, url).id;
	const r = await tutorReport(locals.db, t, Number(params.id) || 0);
	if (!r) error(404, 'Not found');
	return reportResponse(locals.db, r);
};
