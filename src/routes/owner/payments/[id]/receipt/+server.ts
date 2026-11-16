import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { receiptData } from '#lib/server/billing.ts';
import { receiptPdf } from '#lib/server/pdf.ts';
import { requireOwner } from '#lib/server/guards.ts';
import { paymentTutor } from '#lib/server/owner-admin.ts';

/** The owner can download any confirmed payment's receipt (the same PDF the tutor sends). */
export const GET: RequestHandler = async ({ locals, url, params }) => {
	requireOwner(locals.user, url);
	const id = Number(params.id) || 0;
	const tutorId = await paymentTutor(locals.db, id);
	const r = tutorId ? await receiptData(locals.db, id, tutorId) : null;
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
