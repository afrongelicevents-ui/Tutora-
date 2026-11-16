import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { requireTutor } from '#lib/server/guards.ts';
import { unpaidCharges } from '#lib/server/billing.ts';
import { getSettings } from '#lib/server/settings.ts';
import { proAccess, tutorBrand } from '#lib/server/pro.ts';
import { tablePdf } from '#lib/server/pro-pdf.ts';
import { isEnrolled } from '#lib/server/people.ts';
import { user } from '#lib/server/db/auth.schema.ts';
import { formatMoney } from '#lib/money.ts';
import { localDate } from '#lib/tz.ts';
import { m } from '#lib/paraglide/messages.js';

/** Pro: an invoice (PDF) for what one of the tutor's students still owes. */
export const GET: RequestHandler = async ({ locals, url, params }) => {
	const t = requireTutor(locals.user, url).id;
	if (!(await proAccess(locals.db, t)).active) redirect(303, '/tutor/pro?locked=reminders');
	if (!(await isEnrolled(locals.db, t, params.id))) error(404, 'Not found');
	const now = new Date();
	const [s, brand, [who]] = await Promise.all([
		getSettings(locals.db, t),
		tutorBrand(locals.db, t),
		locals.db.select({ name: user.name }).from(user).where(eq(user.id, params.id))
	]);
	const charges = await unpaidCharges(locals.db, t, params.id);
	const due = charges.reduce((a, c) => a + c.due, 0);
	const pay = [
		s.ecocashNumber ? `EcoCash ${s.ecocashNumber}` : null,
		s.innbucksNumber ? `InnBucks ${s.innbucksNumber}` : null,
		s.bankAccountNumber ? `${s.bankName ?? ''} ${s.bankAccountNumber}`.trim() : null,
		s.acceptsCash ? m.method_cash() : null
	].filter(Boolean);
	const pdf = await tablePdf({
		title: m.pro_invoice_title(),
		subtitle: m.pro_invoice_sub({ date: localDate(now) }),
		from: brand?.name || s.tutorName || 'Tutora',
		brandColour: brand?.colour,
		lines: [
			m.pro_invoice_to({ name: who?.name ?? '' }),
			...(pay.length ? [m.pro_invoice_pay({ how: pay.join(' · ') })] : [])
		],
		sections: [
			{
				heading: m.pro_invoice_items(),
				columns: [m.pro_col_item(), m.pro_col_amount(), m.pro_col_due()],
				right: [1, 2],
				rows: charges.map((c) => [
					c.description,
					formatMoney(c.amountCents, s.currency),
					formatMoney(c.due, s.currency)
				]),
				total: [m.pro_col_total(), '', formatMoney(due, s.currency)]
			}
		],
		footer: m.pro_invoice_footer()
	});
	return new Response(pdf as BodyInit, {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `attachment; filename="invoice-${localDate(now)}.pdf"`,
			'cache-control': 'private, no-store'
		}
	});
};
