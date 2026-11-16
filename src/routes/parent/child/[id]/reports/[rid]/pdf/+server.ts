import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { parentAccess } from '#lib/server/family.ts';
import { sentReport } from '#lib/server/reports.ts';
import { reportResponse } from '#lib/server/report-file.ts';

/** A sent report about my child, as a PDF (only when the child shares progress). */
export const GET: RequestHandler = async ({ locals, url, params }) => {
	const u = requireRole(locals.user, url, ['parent']);
	const access = await parentAccess(locals.db, u.id, params.id);
	if (!access.ok || !access.progress) error(404, 'Not found');
	const r = await sentReport(locals.db, params.id, Number(params.rid) || 0);
	if (!r) error(404, 'Not found');
	return reportResponse(locals.db, r);
};
