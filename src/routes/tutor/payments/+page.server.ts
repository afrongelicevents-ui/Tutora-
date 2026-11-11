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
import { addDays, localDate } from '#lib/tz.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	const t = requireTutor(locals.user, url).id;
	const now = new Date();
	const [s, pending, recent, bal, students, months] = await Promise.all([
		getSettings(locals.db, t),
		pendingPayments(locals.db, t),
		recentPayments(locals.db, t, 30),
		balances(locals.db, t),
		listStudents(locals.db, t),
		monthlyTotals(locals.db, t, addDays(now, -366))
	]);
	const rows = students
		.map((x) => ({
			id: x.id,
			name: x.name,
			...(bal.get(x.id) ?? { paid: 0, waiting: 0, owed: 0, credit: 0, charged: 0 })
		}))
		.filter((r) => r.charged || r.paid || r.waiting);
	return {
		currency: s.currency,
		today: localDate(now),
		thisMonth: localDate(now).slice(0, 7),
		months,
		pending: await Promise.all(
			pending.map(async (p) => ({
				...p,
				proofUrl: p.proofKey ? await fileLink(p.proofKey, `proof-${p.id}`) : null
			}))
		),
		recent: recent.map((p) => ({ ...p, receipt: p.receiptNo ? receiptNumber(p.receiptNo) : null })),
		rows,
		totals: rows.reduce((a, r) => ({ owed: a.owed + r.owed, waiting: a.waiting + r.waiting }), {
			owed: 0,
			waiting: 0
		})
	};
};

export const actions: Actions = inboxActions;
