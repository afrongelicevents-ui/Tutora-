import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireTutor } from '#lib/server/guards.ts';
import { monthlyTotals } from '#lib/server/billing.ts';
import { getSettings } from '#lib/server/settings.ts';
import { proAccess, tutorBrand } from '#lib/server/pro.ts';
import { incomeByStudent } from '#lib/server/pro-earnings.ts';
import { tablePdf } from '#lib/server/pro-pdf.ts';
import { formatMoney } from '#lib/money.ts';
import { fmtMonth, fromLocal, localDate } from '#lib/tz.ts';
import { m } from '#lib/paraglide/messages.js';

/** Pro: the earnings report as a PDF: income per month (2 years) and per student (12 months). */
export const GET: RequestHandler = async ({ locals, url }) => {
	const t = requireTutor(locals.user, url).id;
	if (!(await proAccess(locals.db, t)).active) redirect(303, '/tutor/pro?locked=earnings');
	const now = new Date();
	const yearAgo = new Date(now.getTime() - 365 * 86_400_000);
	const [s, months, brand] = await Promise.all([
		getSettings(locals.db, t),
		monthlyTotals(locals.db, t, new Date(now.getTime() - 731 * 86_400_000)),
		tutorBrand(locals.db, t)
	]);
	const students = await incomeByStudent(locals.db, t, s.currency, yearAgo, now);
	const mine = months.filter((x) => x.currency === s.currency);
	const total = (rows: { total: number }[]) => rows.reduce((a, r) => a + r.total, 0);
	const pdf = await tablePdf({
		title: m.pro_report_title(),
		subtitle: m.pro_report_sub({ date: localDate(now) }),
		from: brand?.name || s.tutorName || 'Tutora',
		brandColour: brand?.colour,
		sections: [
			{
				heading: m.by_month(),
				columns: [m.pro_col_month(), m.pro_col_payments(), m.pro_col_income()],
				right: [1, 2],
				rows: mine.map((x) => [
					fmtMonth(fromLocal(x.month + '-15', 600)),
					String(x.count),
					formatMoney(x.total, s.currency)
				]),
				total: [m.pro_col_total(), '', formatMoney(total(mine), s.currency)]
			},
			{
				heading: m.pro_per_student_12m(),
				columns: [m.pro_col_student(), m.pro_col_payments(), m.pro_col_income()],
				right: [1, 2],
				rows: students.map((x) => [x.name, String(x.count), formatMoney(x.total, s.currency)]),
				total: [m.pro_col_total(), '', formatMoney(total(students), s.currency)]
			}
		],
		footer: m.pro_report_footer()
	});
	return new Response(pdf as BodyInit, {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `attachment; filename="earnings-${localDate(now)}.pdf"`,
			'cache-control': 'private, no-store'
		}
	});
};
