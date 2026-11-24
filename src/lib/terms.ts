// Zimbabwe school terms: Tutora Family is paid per term (pure: used by the checkout page
// and by the server). A term covers the holiday after it too, up to the next term's start.

export interface SchoolTerm {
	name: string;
	/** YYYY-MM-DD, Harare time */
	start: string;
	end: string;
}

/** Rough dates the owner should check and correct in Admin → Settings each year. */
export const DEFAULT_TERMS: SchoolTerm[] = [
	{ name: 'Term 3 2026', start: '2026-09-08', end: '2026-12-04' },
	{ name: 'Term 1 2027', start: '2027-01-12', end: '2027-04-09' },
	{ name: 'Term 2 2027', start: '2027-05-04', end: '2027-08-06' },
	{ name: 'Term 3 2027', start: '2027-09-07', end: '2027-12-03' }
];

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86_400_000;

/** midnight in Harare (UTC+2, no daylight saving) */
export const harareDate = (d: string) => new Date(`${d}T00:00:00+02:00`);

/** Keeps only well-formed terms (start before end), sorted by start. */
export function cleanTerms(raw: unknown): SchoolTerm[] {
	if (!Array.isArray(raw)) return [];
	return raw
		.map((t) => ({
			name: String(t?.name ?? '')
				.trim()
				.slice(0, 40),
			start: String(t?.start ?? '').trim(),
			end: String(t?.end ?? '').trim()
		}))
		.filter(
			(t) =>
				t.name &&
				ISO.test(t.start) &&
				ISO.test(t.end) &&
				!isNaN(harareDate(t.start).getTime()) &&
				harareDate(t.start) < harareDate(t.end)
		)
		.sort((a, b) => a.start.localeCompare(b.start))
		.slice(0, 12);
}

/** One term per line: "Term 1 2027, 2027-01-12, 2027-04-09" */
export function parseTermLines(text: string): SchoolTerm[] {
	return cleanTerms(
		String(text ?? '')
			.split('\n')
			.map((l) => l.split(',').map((p) => p.trim()))
			.filter((p) => p.length >= 3)
			.map(([name, start, end]) => ({ name, start, end }))
	);
}

export const termLines = (terms: SchoolTerm[]) =>
	terms.map((t) => `${t.name}, ${t.start}, ${t.end}`).join('\n');

export interface BillTerm {
	name: string;
	start: string;
	end: string;
	/** paid access runs until here: the next term's start (or 7 days after the last term) */
	coversUntil: Date;
	/** share of the term still to come, 0..1: a family joining mid-term pays only for the rest */
	fraction: number;
}

/**
 * The term a payment made from `from` is for: the term running then (only the part still to
 * come), or the next one during a holiday. With no term dates left: the next 3 months, in full.
 */
export function billTerm(terms: SchoolTerm[], from: Date): BillTerm {
	const list = cleanTerms(terms);
	for (let i = 0; i < list.length; i++) {
		const t = list[i];
		const start = harareDate(t.start);
		const end = harareDate(t.end);
		const next = list[i + 1] ? harareDate(list[i + 1].start) : new Date(end.getTime() + 7 * DAY);
		if (from >= next) continue;
		let fraction = 1;
		if (from > start) {
			if (from >= end) continue; // in the holiday after this term: bill the next one
			fraction = (end.getTime() - from.getTime()) / (end.getTime() - start.getTime());
		}
		return { name: t.name, start: t.start, end: t.end, coversUntil: next, fraction };
	}
	const until = new Date(from);
	until.setUTCMonth(until.getUTCMonth() + 3);
	const iso = (d: Date) => d.toISOString().slice(0, 10);
	return { name: '', start: iso(from), end: iso(until), coversUntil: until, fraction: 1 };
}
