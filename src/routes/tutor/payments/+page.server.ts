import { requireTutor } from '#lib/server/guards.ts';
import type { Actions, PageServerLoad } from './$types';
import {
	balances,
	monthlyTotals,
	pendingPayments,
	receiptNumber,
	recentPayments
} from '#lib/server/billing.ts';
import { listStudents } from '#lib/server/people.ts';
import { getSettings } from '#lib/server/settings.ts';
import { fileLink } from '#lib/server/storage.ts';
import { inboxActions } from '#lib/server/actions/tutor-inbox.ts';
import { addDays, fromLocal, localDate, startOfLocalWeek } from '#lib/tz.ts';
import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { payment } from '#lib/server/db/app.schema.ts';
import { lessonsBetween } from '#lib/server/bookings.ts';

type Period = 'week' | 'month' | 'year';
/** [from, to) of this period and the one before it, Zimbabwe time. */
function periodRange(p: Period, now: Date) {
	if (p === 'week') {
		const from = startOfLocalWeek(now);
		return { from, to: addDays(from, 7), prevFrom: addDays(from, -7) };
	}
	const d = localDate(now);
	if (p === 'year') {
		const y = Number(d.slice(0, 4));
		return {
			from: fromLocal(`${y}-01-01`, 0),
			to: fromLocal(`${y + 1}-01-01`, 0),
			prevFrom: fromLocal(`${y - 1}-01-01`, 0)
		};
	}
	const [y, mo] = d.split('-').map(Number);
	const iso = (yy: number, mm: number) =>
		`${yy + Math.floor((mm - 1) / 12)}-${String(((mm - 1 + 120) % 12) + 1).padStart(2, '0')}-01`;
	return {
		from: fromLocal(iso(y, mo), 0),
		to: fromLocal(iso(y, mo + 1), 0),
		prevFrom: fromLocal(iso(y, mo - 1), 0)
	};
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const t = requireTutor(locals.user, url).id;
	const now = new Date();
	const pp = url.searchParams.get('period');
	const period: Period = pp === 'week' || pp === 'year' ? pp : 'month';
	const r = periodRange(period, now);
	const [s, pending, recent, bal, students, months] = await Promise.all([
		getSettings(locals.db, t),
		pendingPayments(locals.db, t),
		recentPayments(locals.db, t, 30),
		balances(locals.db, t),
		listStudents(locals.db, t),
		monthlyTotals(locals.db, t, addDays(now, -3 * 366))
	]);
	const rows = students
		.map((x) => ({
			id: x.id,
			name: x.name,
			...(bal.get(x.id) ?? { paid: 0, waiting: 0, owed: 0, credit: 0, charged: 0 })
		}))
		.filter((r) => r.charged || r.paid || r.waiting)
		// "owes" = not paid and not reported yet: the same figure the student and parent see
		// (a payment waiting for the tutor's OK is shown on its own as "waiting")
		.map((r) => ({ ...r, owed: Math.max(0, r.owed - r.waiting) }));
	// confirmed payments in this period and the one before (tutor's own currency)
	const sumBetween = async (from: Date, to: Date) => {
		const [x] = await locals.db
			.select({ total: sql<number>`coalesce(sum(${payment.amountCents}), 0)::int` })
			.from(payment)
			.where(
				and(
					eq(payment.tutorId, t),
					eq(payment.status, 'confirmed'),
					eq(payment.currency, s.currency),
					gte(payment.decidedAt, from),
					lt(payment.decidedAt, to)
				)
			);
		return x?.total ?? 0;
	};
	const total = await sumBetween(r.from, r.to);
	const prevTotal = await sumBetween(r.prevFrom, r.from);
	const periodLessons = await lessonsBetween(locals.db, t, r.from, r.to);
	// lessons actually taught: someone came (a lesson where everyone was marked absent is left out)
	const lessonsDone = periodLessons.filter(
		(l) => l.endsAt <= now && l.people.some((p) => p.attendance !== 'absent')
	).length;
	return {
		period,
		summary: {
			total,
			prevTotal,
			change: prevTotal > 0 ? Math.round((100 * (total - prevTotal)) / prevTotal) : null,
			lessonsDone,
			avgPerLesson: lessonsDone ? Math.round(total / lessonsDone) : null
		},
		pay: {
			bank: !!s.bankAccountNumber,
			ecocash: !!s.ecocashNumber,
			innbucks: !!s.innbucksNumber,
			cash: s.acceptsCash
		},
		currency: s.currency,
		today: localDate(now),
		thisMonth: localDate(now).slice(0, 7),
		months: months.slice(0, 24),
		// totals per year (from the monthly totals)
		years: Object.values(
			months.reduce<
				Record<string, { year: string; currency: 'USD' | 'ZWG'; total: number; count: number }>
			>((acc, x) => {
				const k = x.month.slice(0, 4) + x.currency;
				acc[k] ??= { year: x.month.slice(0, 4), currency: x.currency, total: 0, count: 0 };
				acc[k].total += x.total;
				acc[k].count += x.count;
				return acc;
			}, {})
		),
		pending: await Promise.all(
			pending.map(async (p) => ({
				...p,
				proofUrl: p.proofKey ? await fileLink(p.proofKey, `proof-${p.id}`) : null
			}))
		),
		// pending ones are listed above with their Confirm button
		recent: recent
			.filter((p) => p.status !== 'pending')
			.map((p) => ({ ...p, receipt: p.receiptNo ? receiptNumber(p.receiptNo) : null })),
		rows,
		totals: rows.reduce((a, r) => ({ owed: a.owed + r.owed, waiting: a.waiting + r.waiting }), {
			owed: 0,
			waiting: 0
		})
	};
};

export const actions: Actions = inboxActions;
