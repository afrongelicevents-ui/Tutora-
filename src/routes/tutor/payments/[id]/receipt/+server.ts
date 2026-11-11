import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { receiptData } from '#lib/server/billing.ts';
import { receiptPdf } from '#lib/server/pdf.ts';
import { requireTutor } from '#lib/server/guards.ts';

export const GET: RequestHandler = async ({ locals, url, params }) => {
	const t = requireTutor(locals.user, url).id;
	// only receipts of payments made to THIS tutor
	const r = await receiptData(locals.db, Number(params.id) || 0, t);
	if (!r) error(404, 'Not found');
	const pdf = await receiptPdf(r);
	return new Response(pdf as BodyInit, {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `attachment; filename="receipt-${r.number}.pdf"`,
			'cache-control': 'private, no-store'
		}
	});
};
