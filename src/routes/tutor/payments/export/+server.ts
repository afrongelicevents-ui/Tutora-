import type { RequestHandler } from './$types';
import { paymentsBetween, receiptNumber, toCsv } from '#lib/server/billing.ts';
import { requireTutor } from '#lib/server/guards.ts';
import { localDate } from '#lib/tz.ts';

/** All payments of the last 2 years as a spreadsheet file (amounts in normal units, not cents). */
export const GET: RequestHandler = async ({ locals, url }) => {
	const t = requireTutor(locals.user, url).id;
	const now = new Date();
	const rows = await paymentsBetween(locals.db, t, new Date(now.getTime() - 730 * 86_400_000), now);
	const csv = toCsv([
		['Date', 'Student', 'Amount', 'Currency', 'Method', 'Reference', 'Status', 'Receipt'],
		...rows.map((p) => [
			localDate(p.createdAt),
			p.studentName,
			(p.amountCents / 100).toFixed(2),
			p.currency,
			p.method,
			p.reference,
			p.status,
			p.receiptNo ? receiptNumber(p.receiptNo) : null
		])
	]);
	return new Response(csv, {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="tutora-payments-${localDate(now)}.csv"`,
			'cache-control': 'private, no-store'
		}
	});
};
