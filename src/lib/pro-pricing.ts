// Tutora Pro price for tutors (pure: used by the page and the server). $5 a month; paying
// 3 or 6 months ahead uses the same owner discounts as Tutora Family.
import { discountFor, isPeriod, type Discounts, type Period } from './family-pricing.ts';

export const PRO_MONTHLY_CENTS = 500;

export interface ProQuote {
	period: Period;
	discountPct: number;
	grossCents: number;
	totalCents: number;
}

export function proQuote(period: number, d: Discounts): ProQuote {
	const p: Period = isPeriod(period) ? (Number(period) as Period) : 1;
	const pct = discountFor(p, d);
	const gross = PRO_MONTHLY_CENTS * p;
	return {
		period: p,
		discountPct: pct,
		grossCents: gross,
		totalCents: Math.round((gross * (100 - pct)) / 100)
	};
}

/** What Pro adds (keys of `pro_f_*` messages), in the order shown on the plan page. */
export const PRO_FEATURES = [
	'ai',
	'earnings',
	'reminders',
	'insights',
	'groups',
	'branded',
	'export'
] as const;
export type ProFeature = (typeof PRO_FEATURES)[number];

/** Free for every tutor (keys of `pro_free_*` messages). */
export const FREE_TUTOR_FEATURES = [
	'profile',
	'bookings',
	'homework',
	'payments',
	'tests'
] as const;
