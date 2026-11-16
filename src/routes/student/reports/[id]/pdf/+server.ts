import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { sentReport } from '#lib/server/reports.ts';
import { reportResponse } from '#lib/server/report-file.ts';

/** My report as a PDF: my copy never carries a parent-only note. */
export const GET: RequestHandler = async ({ locals, url, params }) => {
	const u = requireRole(locals.user, url, ['student']);
	const r = await sentReport(locals.db, u.id, Number(params.id) || 0);
	if (!r) error(404, 'Not found');
	return reportResponse(locals.db, r, { forStudent: true });
};
