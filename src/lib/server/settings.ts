import { and, asc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import {
	availability,
	lessonPackage,
	resultHighlight,
	review,
	tutorProfile,
	subject
} from './db/app.schema.ts';
import type { AvailabilityRow } from '../validation/settings.ts';

/** One tutor's settings (their public page, lessons, prices, contact and payment details). */
export type SiteSettings = typeof tutorProfile.$inferSelect;
export type SettingsPatch = Partial<
	Omit<
		SiteSettings,
		'tutorId' | 'slug' | 'status' | 'approvedAt' | 'plan' | 'planUntil' | 'createdAt' | 'updatedAt'
	>
>;

export class NoTutorProfile extends Error {}

/** A tutor's settings. Every tutor gets a profile row when their account is made. */
export async function getSettings(db: DB, tutorId: string): Promise<SiteSettings> {
	const [row] = await db.select().from(tutorProfile).where(eq(tutorProfile.tutorId, tutorId));
	if (!row) throw new NoTutorProfile(tutorId);
	return row;
}

export async function findSettings(db: DB, tutorId: string): Promise<SiteSettings | null> {
	const [row] = await db.select().from(tutorProfile).where(eq(tutorProfile.tutorId, tutorId));
	return row ?? null;
}

export async function updateSettings(db: DB, tutorId: string, patch: SettingsPatch): Promise<void> {
	await db.update(tutorProfile).set(patch).where(eq(tutorProfile.tutorId, tutorId));
}

/* ---------- tutor accounts on the platform ---------- */

/** "Mr T. Moyo" -> "mr-t-moyo" (page address). */
export function slugify(name: string): string {
	const s = name
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.slice(0, 40)
		.replace(/^-+|-+$/g, '');
	return s || 'tutor';
}

const RESERVED = new Set(['admin', 'owner', 'tutor', 'tutors', 'join', 'setup', 'login', 'api']);

/** A free page address based on the name: "mr-t-moyo", "mr-t-moyo-2", ... */
export async function freeSlug(db: DB, name: string): Promise<string> {
	const base = slugify(name).slice(0, 36).replace(/-+$/, '') || 'tutor';
	const taken = new Set(
		(
			await db
				.select({ slug: tutorProfile.slug })
				.from(tutorProfile)
				.where(sql`${tutorProfile.slug} = ${base} or ${tutorProfile.slug} like ${base + '-%'}`)
		).map((r) => r.slug)
	);
	if (!taken.has(base) && !RESERVED.has(base)) return base;
	for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

/** Makes the settings row for a new tutor account. */
export async function createTutorProfile(
	db: DB,
	tutorId: string,
	name: string,
	status: SiteSettings['status'] = 'pending'
) {
	for (let attempt = 0; attempt < 5; attempt++) {
		const slug = await freeSlug(db, name);
		const rows = await db
			.insert(tutorProfile)
			.values({
				tutorId,
				slug,
				status,
				tutorName: name,
				approvedAt: status === 'active' ? new Date() : null
			})
			.onConflictDoNothing()
			.returning();
		if (rows[0]) return rows[0];
		const [existing] = await db
			.select()
			.from(tutorProfile)
			.where(eq(tutorProfile.tutorId, tutorId));
		if (existing) return existing;
	}
	throw new Error('Could not find a free page address');
}

/** An approved tutor's settings by page address (null if unknown, pending or suspended). */
export async function activeTutorBySlug(db: DB, slug: string): Promise<SiteSettings | null> {
	if (!/^[a-z0-9-]{1,40}$/.test(slug)) return null;
	const [row] = await db
		.select()
		.from(tutorProfile)
		.where(and(eq(tutorProfile.slug, slug), eq(tutorProfile.status, 'active')));
	return row ?? null;
}

export async function isActiveTutor(db: DB, tutorId: string): Promise<boolean> {
	const [row] = await db
		.select({ id: tutorProfile.tutorId })
		.from(tutorProfile)
		.where(and(eq(tutorProfile.tutorId, tutorId), eq(tutorProfile.status, 'active')));
	return !!row;
}

export interface TutorCard {
	slug: string;
	name: string;
	headline: string | null;
	town: string | null;
	hasPhoto: boolean;
	photoVersion: number;
	tutorId: string;
	subjects: string[];
	lessonModes: SiteSettings['lessonModes'];
}

/**
 * Approved tutors for "Find a tutor", optionally only those teaching a subject
 * (matched by name, ignoring case). Tutors without a name yet are left out.
 */
export async function listTutors(db: DB, subjectQuery?: string): Promise<TutorCard[]> {
	const tutors = await db
		.select()
		.from(tutorProfile)
		.where(and(eq(tutorProfile.status, 'active'), isNotNull(tutorProfile.tutorName)))
		.orderBy(asc(tutorProfile.tutorName));
	if (!tutors.length) return [];
	const subs = await db
		.select({ tutorId: subject.tutorId, name: subject.name })
		.from(subject)
		.where(
			and(
				eq(subject.active, true),
				inArray(
					subject.tutorId,
					tutors.map((t) => t.tutorId)
				)
			)
		)
		.orderBy(asc(subject.sortOrder), asc(subject.id));
	const q = subjectQuery?.trim().toLowerCase();
	return tutors
		.map((t) => ({
			slug: t.slug,
			name: t.tutorName!,
			headline: t.headline,
			town: t.town,
			hasPhoto: !!t.photoKey,
			photoVersion: t.photoVersion,
			tutorId: t.tutorId,
			subjects: subs.filter((x) => x.tutorId === t.tutorId).map((x) => x.name),
			lessonModes: t.lessonModes
		}))
		.filter((t) => !q || t.subjects.some((n) => n.toLowerCase().includes(q)));
}

/** Distinct subject names taught by approved tutors (for the "Find a tutor" filter). */
export async function allSubjectNames(db: DB): Promise<string[]> {
	const rows = await db
		.selectDistinct({ name: subject.name })
		.from(subject)
		.innerJoin(tutorProfile, eq(tutorProfile.tutorId, subject.tutorId))
		.where(and(eq(subject.active, true), eq(tutorProfile.status, 'active')))
		.orderBy(asc(subject.name));
	const seen = new Set<string>();
	return rows
		.map((r) => r.name.trim())
		.filter((n) => {
			const k = n.toLowerCase();
			if (seen.has(k)) return false;
			seen.add(k);
			return true;
		});
}

/* ---------- subjects ---------- */

export const listSubjects = (db: DB, tutorId: string, activeOnly = true) =>
	db
		.select()
		.from(subject)
		.where(and(eq(subject.tutorId, tutorId), activeOnly ? eq(subject.active, true) : undefined))
		.orderBy(asc(subject.sortOrder), asc(subject.id));

export async function addSubject(
	db: DB,
	tutorId: string,
	v: { name: string; levels: string; price: number | null }
) {
	const [row] = await db
		.insert(subject)
		.values({ tutorId, name: v.name, levels: v.levels, priceCents: v.price })
		.returning();
	return row;
}

export async function updateSubject(
	db: DB,
	tutorId: string,
	id: number,
	v: { name: string; levels: string; price: number | null }
) {
	await db
		.update(subject)
		.set({ name: v.name, levels: v.levels, priceCents: v.price })
		.where(and(eq(subject.id, id), eq(subject.tutorId, tutorId)));
}

/** Subjects are hidden, not deleted, so old lessons keep their subject. */
export async function removeSubject(db: DB, tutorId: string, id: number) {
	await db
		.update(subject)
		.set({ active: false })
		.where(and(eq(subject.id, id), eq(subject.tutorId, tutorId)));
}

/* ---------- packages ---------- */

export const listPackages = (db: DB, tutorId: string, activeOnly = true) =>
	db
		.select()
		.from(lessonPackage)
		.where(
			and(
				eq(lessonPackage.tutorId, tutorId),
				activeOnly ? eq(lessonPackage.active, true) : undefined
			)
		)
		.orderBy(asc(lessonPackage.lessonCount));

export async function addPackage(
	db: DB,
	tutorId: string,
	v: { name: string; lessonCount: number; price: number }
) {
	const [row] = await db
		.insert(lessonPackage)
		.values({ tutorId, name: v.name, lessonCount: v.lessonCount, priceCents: v.price })
		.returning();
	return row;
}

export async function removePackage(db: DB, tutorId: string, id: number) {
	await db
		.update(lessonPackage)
		.set({ active: false })
		.where(and(eq(lessonPackage.id, id), eq(lessonPackage.tutorId, tutorId)));
}

/* ---------- weekly free times ---------- */

export const listAvailability = (db: DB, tutorId: string) =>
	db
		.select()
		.from(availability)
		.where(eq(availability.tutorId, tutorId))
		.orderBy(asc(availability.weekday), asc(availability.startMinute));

export async function replaceAvailability(db: DB, tutorId: string, rows: AvailabilityRow[]) {
	await db.transaction(async (tx) => {
		await tx.delete(availability).where(eq(availability.tutorId, tutorId));
		if (rows.length) await tx.insert(availability).values(rows.map((r) => ({ ...r, tutorId })));
	});
}

/* ---------- results ---------- */

export const listResults = (db: DB, tutorId: string) =>
	db
		.select()
		.from(resultHighlight)
		.where(eq(resultHighlight.tutorId, tutorId))
		.orderBy(asc(resultHighlight.sortOrder), asc(resultHighlight.id));

export async function addResult(db: DB, tutorId: string, v: { value: string; label: string }) {
	await db.insert(resultHighlight).values({ ...v, tutorId });
}

export async function removeResult(db: DB, tutorId: string, id: number) {
	await db
		.delete(resultHighlight)
		.where(and(eq(resultHighlight.id, id), eq(resultHighlight.tutorId, tutorId)));
}

/* ---------- what the public site may show ---------- */

export interface PublicSite {
	slug: string;
	tutorId: string;
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
export async function publicSite(db: DB, s: SiteSettings): Promise<PublicSite> {
	const tutorId = s.tutorId;
	const [subjects, packages, results, reviews] = await Promise.all([
		listSubjects(db, tutorId),
		listPackages(db, tutorId),
		listResults(db, tutorId),
		db
			.select({ displayName: review.displayName, rating: review.rating, text: review.text })
			.from(review)
			.where(and(eq(review.tutorId, tutorId), eq(review.hidden, false)))
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
		slug: s.slug,
		tutorId,
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
