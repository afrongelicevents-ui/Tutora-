import { asc, eq } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import {
	availability,
	lessonPackage,
	resultHighlight,
	review,
	siteSettings,
	subject
} from './db/app.schema.ts';
import type { AvailabilityRow } from '../validation/settings.ts';

export type SiteSettings = typeof siteSettings.$inferSelect;
export type SettingsPatch = Partial<Omit<SiteSettings, 'id' | 'updatedAt'>>;

export async function getSettings(db: DB): Promise<SiteSettings> {
	const rows = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
	if (rows[0]) return rows[0];
	await db.insert(siteSettings).values({ id: 1 }).onConflictDoNothing();
	return (await db.select().from(siteSettings).where(eq(siteSettings.id, 1)))[0];
}

export async function updateSettings(db: DB, patch: SettingsPatch): Promise<void> {
	await getSettings(db);
	await db.update(siteSettings).set(patch).where(eq(siteSettings.id, 1));
}

/* ---------- subjects ---------- */

export const listSubjects = (db: DB, activeOnly = true) =>
	db
		.select()
		.from(subject)
		.where(activeOnly ? eq(subject.active, true) : undefined)
		.orderBy(asc(subject.sortOrder), asc(subject.id));

export async function addSubject(
	db: DB,
	v: { name: string; levels: string; price: number | null }
) {
	const [row] = await db
		.insert(subject)
		.values({ name: v.name, levels: v.levels, priceCents: v.price })
		.returning();
	return row;
}

export async function updateSubject(
	db: DB,
	id: number,
	v: { name: string; levels: string; price: number | null }
) {
	await db
		.update(subject)
		.set({ name: v.name, levels: v.levels, priceCents: v.price })
		.where(eq(subject.id, id));
}

/** Subjects are hidden, not deleted, so old lessons keep their subject. */
export async function removeSubject(db: DB, id: number) {
	await db.update(subject).set({ active: false }).where(eq(subject.id, id));
}

/* ---------- packages ---------- */

export const listPackages = (db: DB, activeOnly = true) =>
	db
		.select()
		.from(lessonPackage)
		.where(activeOnly ? eq(lessonPackage.active, true) : undefined)
		.orderBy(asc(lessonPackage.lessonCount));

export async function addPackage(db: DB, v: { name: string; lessonCount: number; price: number }) {
	const [row] = await db
		.insert(lessonPackage)
		.values({ name: v.name, lessonCount: v.lessonCount, priceCents: v.price })
		.returning();
	return row;
}

export async function removePackage(db: DB, id: number) {
	await db.update(lessonPackage).set({ active: false }).where(eq(lessonPackage.id, id));
}

/* ---------- weekly free times ---------- */

export const listAvailability = (db: DB) =>
	db.select().from(availability).orderBy(asc(availability.weekday), asc(availability.startMinute));

export async function replaceAvailability(db: DB, rows: AvailabilityRow[]) {
	await db.transaction(async (tx) => {
		await tx.delete(availability);
		if (rows.length) await tx.insert(availability).values(rows);
	});
}

/* ---------- results ---------- */

export const listResults = (db: DB) =>
	db
		.select()
		.from(resultHighlight)
		.orderBy(asc(resultHighlight.sortOrder), asc(resultHighlight.id));

export async function addResult(db: DB, v: { value: string; label: string }) {
	await db.insert(resultHighlight).values(v);
}

export async function removeResult(db: DB, id: number) {
	await db.delete(resultHighlight).where(eq(resultHighlight.id, id));
}

/* ---------- what the public site may show ---------- */

export interface PublicSite {
	name: string | null;
	headline: string | null;
	town: string | null;
	bio: string | null;
	qualifications: string | null;
	yearsTeaching: number | null;
	teachingStyle: string | null;
	hasPhoto: boolean;
	photoVersion: number;
	whatsapp: string | null;
	phone: string | null;
	email: string | null;
	lessonModes: SiteSettings['lessonModes'];
	groupMode: SiteSettings['groupMode'];
	maxGroupSize: number;
	lessonMinutes: number;
	currency: SiteSettings['currency'];
	showPrices: boolean;
	subjects: { id: number; name: string; levels: string; priceCents: number | null }[];
	packages: { id: number; name: string; lessonCount: number; priceCents: number | null }[];
	results: { value: string; label: string }[];
	reviews: { displayName: string; rating: number; text: string }[];
	/** sections with content; empty ones are hidden */
	has: { about: boolean; subjects: boolean; results: boolean; reviews: boolean; anything: boolean };
}

/**
 * Everything the public pages can show. Prices are removed when the tutor chose
 * "Ask for price", results only appear with the permission box ticked, hidden reviews
 * never leave the server, and payment details are not included at all.
 */
export async function publicSite(db: DB): Promise<PublicSite> {
	const [s, subjects, packages, results, reviews] = await Promise.all([
		getSettings(db),
		listSubjects(db),
		listPackages(db),
		listResults(db),
		db
			.select({ displayName: review.displayName, rating: review.rating, text: review.text })
			.from(review)
			.where(eq(review.hidden, false))
			.orderBy(asc(review.id))
	]);
	const price = (c: number | null) => (s.showPrices ? (c ?? s.defaultPriceCents) : null);
	const shownResults = s.resultsConsent
		? results.map((r) => ({ value: r.value, label: r.label }))
		: [];
	const has = {
		about: !!(s.bio || s.qualifications || s.teachingStyle || s.yearsTeaching),
		subjects: subjects.length > 0,
		results: shownResults.length > 0,
		reviews: reviews.length > 0,
		anything: false
	};
	has.anything = !!(s.tutorName || s.headline || has.about || has.subjects);
	return {
		name: s.tutorName,
		headline: s.headline,
		town: s.town,
		bio: s.bio,
		qualifications: s.qualifications,
		yearsTeaching: s.yearsTeaching,
		teachingStyle: s.teachingStyle,
		hasPhoto: !!s.photoKey,
		photoVersion: s.photoVersion,
		whatsapp: s.whatsappNumber,
		phone: s.phone,
		email: s.contactEmail,
		lessonModes: s.lessonModes,
		groupMode: s.groupMode,
		maxGroupSize: s.maxGroupSize,
		lessonMinutes: s.lessonMinutes,
		currency: s.currency,
		showPrices: s.showPrices,
		subjects: subjects.map((x) => ({
			id: x.id,
			name: x.name,
			levels: x.levels,
			priceCents: price(x.priceCents)
		})),
		packages: packages.map((p) => ({
			id: p.id,
			name: p.name,
			lessonCount: p.lessonCount,
			priceCents: s.showPrices ? p.priceCents : null
		})),
		results: shownResults,
		reviews,
		has
	};
}

/** Payment details, for logged-in students and parents only. */
export function paymentDetails(s: SiteSettings) {
	return {
		bank: s.bankAccountNumber
			? {
					name: s.bankName,
					accountName: s.bankAccountName,
					number: s.bankAccountNumber,
					branch: s.bankBranch
				}
			: null,
		ecocash: s.ecocashNumber ? { number: s.ecocashNumber, name: s.ecocashName } : null,
		innbucks: s.innbucksNumber ? { number: s.innbucksNumber, name: s.innbucksName } : null,
		note: s.paymentNote
	};
}

/** Price of one lesson of this subject (subject price, else the default price, else free). */
export function lessonPrice(
	s: SiteSettings,
	subj: { priceCents: number | null } | null,
	kind: 'lesson' | 'intro'
) {
	if (kind === 'intro') return 0;
	return subj?.priceCents ?? s.defaultPriceCents ?? 0;
}
