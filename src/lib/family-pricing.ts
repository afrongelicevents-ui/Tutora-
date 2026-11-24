// Tutora Family prices (pure: used by the checkout page's live total and by the server).
// Paid per school term: $25 for the 1st child, 10% off ($22.50) for each other child.
// A family joining mid-term pays only for the part of the term still to come.
// (The monthly prices below are kept for invoices made before terms.)

export const TERM_FIRST_CENTS = 2500;
export const SIBLING_DISCOUNT_PCT = 10;

/** term price in cents of the child in position `i` (0 = first child) */
export function childTermCents(i: number): number {
	const full = TERM_FIRST_CENTS;
	return i <= 0 ? full : Math.round((full * (100 - SIBLING_DISCOUNT_PCT)) / 100);
}

export interface TermQuote {
	children: number;
	/** share of the term being paid for, 0..1 */
	fraction: number;
	/** the whole term, before any mid-term reduction */
	fullCents: number;
	totalCents: number;
	/** per child (sums to totalCents) */
	perChildCents: number[];
}

/** Rounded to 50 cents (easy to pay in cash), never below $1 a child. */
export function termQuote(n: number, fraction = 1): TermQuote {
	const f = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 1));
	const full = Array.from({ length: n }, (_, i) => childTermCents(i));
	const perChild = full.map((c) => (f >= 1 ? c : Math.max(100, Math.round((c * f) / 50) * 50)));
	return {
		children: n,
		fraction: f,
		fullCents: full.reduce((a, b) => a + b, 0),
		totalCents: perChild.reduce((a, b) => a + b, 0),
		perChildCents: perChild
	};
}

export const PERIODS = [1, 3, 6] as const;
export type Period = (typeof PERIODS)[number];

/** monthly price in cents of the child in position `i` (0 = first child) */
export function childMonthlyCents(i: number): number {
	if (i <= 0) return 1200;
	if (i <= 2) return 800;
	return 1000;
}

/** monthly total in cents for `n` children: 1 → 12, 2 → 20, 3 → 28, 4 → 38 dollars */
export function monthlyCents(n: number): number {
	let total = 0;
	for (let i = 0; i < n; i++) total += childMonthlyCents(i);
	return total;
}

export interface Discounts {
	discount3mPct: number;
	discount6mPct: number;
}

export function discountFor(period: number, d: Discounts): number {
	const pct = period === 6 ? d.discount6mPct : period === 3 ? d.discount3mPct : 0;
	return Math.max(0, Math.min(90, Math.round(pct || 0)));
}

export interface Quote {
	children: number;
	period: Period;
	monthlyCents: number;
	discountPct: number;
	/** before the discount */
	grossCents: number;
	totalCents: number;
	/** per child for the whole period, after the discount (sums to totalCents) */
	perChildCents: number[];
}

export function isPeriod(p: unknown): p is Period {
	return PERIODS.includes(Number(p) as Period);
}

export function quote(n: number, period: number, d: Discounts): Quote {
	const p: Period = isPeriod(period) ? (Number(period) as Period) : 1;
	const pct = discountFor(p, d);
	const per = Array.from({ length: n }, (_, i) => childMonthlyCents(i) * p);
	const gross = per.reduce((a, b) => a + b, 0);
	const total = Math.round((gross * (100 - pct)) / 100);
	// share the discount over the children; any rounding goes on the first child
	const perChild = per.map((c) => Math.round((c * (100 - pct)) / 100));
	if (perChild.length) perChild[0] += total - perChild.reduce((a, b) => a + b, 0);
	return {
		children: n,
		period: p,
		monthlyCents: monthlyCents(n),
		discountPct: pct,
		grossCents: gross,
		totalCents: total,
		perChildCents: perChild
	};
}

export const dollars = (cents: number) =>
	'$' + (cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2));
