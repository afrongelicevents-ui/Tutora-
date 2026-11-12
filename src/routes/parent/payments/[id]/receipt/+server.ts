import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPayment, receiptData } from '#lib/server/billing.ts';
import { receiptPdf } from '#lib/server/pdf.ts';
import { requireRole } from '#lib/server/guards.ts';
import { parentPayer } from '#lib/server/parent-payer.ts';

/** Receipts for the parent's own payments, or a child's they are guardian of. */
export const GET: RequestHandler = async ({ locals, url, params }) => {
	const u = requireRole(locals.user, url, ['parent']);
	const payer = await parentPayer(locals.db, u, url);
	const id = Number(params.id) || 0;
	const p = await getPayment(locals.db, id);
	if (!p || p.userId !== payer.id) error(404, 'Not found');
	const r = await receiptData(locals.db, id);
	if (!r) error(404, 'Not found');
	return new Response((await receiptPdf(r)) as BodyInit, {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `attachment; filename="receipt-${r.number}.pdf"`,
			'cache-control': 'private, no-store'
		}
	});
};
