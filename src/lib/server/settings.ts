import { and, asc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import {
	availability,
	lessonPackage,
	resultHighlight,
	review,
	tutorProfile,
	subject,
	platformSubject
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

/** Any tutor's settings by page address, whatever their status (owner preview only). */
export async function tutorBySlug(db: DB, slug: string): Promise<SiteSettings | null> {
	if (!/^[a-z0-9-]{1,40}$/.test(slug)) return null;
	const [row] = await db.select().from(tutorProfile).where(eq(tutorProfile.slug, slug));
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
	bio: string | null;
	town: string | null;
	hasPhoto: boolean;
	photoVersion: number;
	tutorId: string;
	subjects: string[];
	levels: string[];
	lessonModes: SiteSettings['lessonModes'];
	services: string[];
	/** cheapest lesson price shown publicly, or null for "Ask for price" */
	fromPriceCents: number | null;
	currency: SiteSettings['currency'];
	/** only real, visible reviews; null when there are none */
	rating: number | null;
	reviewCount: number;
	/** lessons that really took place */
	lessonCount: number;
	createdAt: Date;
}

export interface TutorFilter {
	subject?: string;
	level?: string;
	mode?: 'online' | 'in_person' | '';
	location?: string;
	sort?: 'rating' | 'price' | 'newest' | '';
	/** free text: subject, topic, name or words in the profile */
	q?: string;
	/** only tutors whose shown price is at most this (tutors who hide prices are left out) */
	maxPriceCents?: number | null;
	/** only tutors who offer this kind of help (src/lib/services.ts) */
	service?: string;
}

/**
 * Approved tutors for "Find a tutor" and the homepage, with real ratings and lesson counts.
 * Filters: subject and level (by name, ignoring case), online / in person, town.
 */
export async function listTutors(db: DB, f: TutorFilter | string = {}): Promise<TutorCard[]> {
	const filter: TutorFilter = typeof f === 'string' ? { subject: f } : f;
	const tutors = await db
		.select()
		.from(tutorProfile)
		.where(and(eq(tutorProfile.status, 'active'), isNotNull(tutorProfile.tutorName)))
		.orderBy(asc(tutorProfile.tutorName));
	if (!tutors.length) return [];
	const ids = tutors.map((t) => t.tutorId);
	const [subs, ratings, lessons] = await Promise.all([
		db
			.select({
				tutorId: subject.tutorId,
				name: subject.name,
				levels: subject.levels,
				priceCents: subject.priceCents
			})
			.from(subject)
			.where(and(eq(subject.active, true), inArray(subject.tutorId, ids)))
			.orderBy(asc(subject.sortOrder), asc(subject.id)),
		db
			.select({
				tutorId: review.tutorId,
				avg: sql<number>`avg(${review.rating})::float`,
				n: sql<number>`count(*)::int`
			})
			.from(review)
			.where(and(inArray(review.tutorId, ids), eq(review.hidden, false)))
			.groupBy(review.tutorId),
		db.execute(sql`
			select l.tutor_id as "tutorId", count(*)::int as n
			from attendee a join lesson l on l.id = a.lesson_id
			where l.tutor_id in (${sql.join(
				ids.map((id) => sql`${id}`),
				sql`, `
			)})
			  and l.status = 'scheduled' and a.status = 'booked' and l.ends_at < now()
			  and coalesce(a.attendance, 'completed') <> 'absent'
			group by l.tutor_id`)
	]);
	const lessonRows = ((lessons as unknown as { rows?: { tutorId: string; n: number }[] }).rows ??
		(lessons as unknown as { tutorId: string; n: number }[])) as { tutorId: string; n: number }[];
	const lower = (v?: string) => v?.trim().toLowerCase() ?? '';
	const q = {
		subject: lower(filter.subject),
		level: lower(filter.level),
		town: lower(filter.location),
		text: lower(filter.q)
	};
	let cards: TutorCard[] = tutors.map((t) => {
		const mine = subs.filter((x) => x.tutorId === t.tutorId);
		const prices = t.showPrices
			? mine.map((x) => x.priceCents ?? t.defaultPriceCents).filter((x): x is number => x != null)
			: [];
		const r = ratings.find((x) => x.tutorId === t.tutorId);
		return {
			slug: t.slug,
			name: t.tutorName!,
			headline: t.headline,
			bio: t.bio,
			town: t.town,
			hasPhoto: !!t.photoKey,
			photoVersion: t.photoVersion,
			tutorId: t.tutorId,
			subjects: mine.map((x) => x.name),
			levels: [
				...new Set(
					mine.flatMap((x) =>
						x.levels
							.split(',')
							.map((l) => l.trim())
							.filter(Boolean)
					)
				)
			],
			lessonModes: t.lessonModes,
			fromPriceCents: prices.length ? Math.min(...prices) : null,
			currency: t.currency,
			rating: r && r.n > 0 ? Math.round(r.avg * 10) / 10 : null,
			reviewCount: r?.n ?? 0,
			lessonCount: lessonRows.find((x) => x.tutorId === t.tutorId)?.n ?? 0,
			createdAt: t.createdAt,
			services: t.services ?? []
		};
	});
	cards = cards.filter(
		(t) =>
			(!filter.service || t.services.includes(filter.service)) &&
			(!q.subject || t.subjects.some((n) => n.toLowerCase().includes(q.subject))) &&
			(!q.level || t.levels.some((n) => n.toLowerCase().includes(q.level))) &&
			(!q.town || (t.town ?? '').toLowerCase().includes(q.town)) &&
			(!filter.mode || t.lessonModes === 'both' || t.lessonModes === filter.mode) &&
			(!filter.maxPriceCents ||
				(t.fromPriceCents !== null && t.fromPriceCents <= filter.maxPriceCents)) &&
			(!q.text ||
				[t.name, t.headline ?? '', t.bio ?? '', t.town ?? '', ...t.subjects, ...t.levels]
					.join(' ')
					.toLowerCase()
					.includes(q.text))
	);
	if (filter.sort === 'rating')
		cards.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.reviewCount - a.reviewCount);
	else if (filter.sort === 'price')
		cards.sort((a, b) => (a.fromPriceCents ?? 1e12) - (b.fromPriceCents ?? 1e12));
	else if (filter.sort === 'newest') cards.sort((a, b) => +b.createdAt - +a.createdAt);
	return cards;
}

/** Up to 3 tutors for the homepage: best rated and most lessons first. */
export async function popularTutors(db: DB, n = 3) {
	const all = await listTutors(db);
	return all
		.sort(
			(a, b) =>
				(b.rating ?? 0) * Math.log2(2 + b.reviewCount) -
					(a.rating ?? 0) * Math.log2(2 + a.reviewCount) || b.lessonCount - a.lessonCount
		)
		.slice(0, n);
}

/** The standard subjects list (owner admin) plus any subject an approved tutor teaches. */
export async function subjectOptions(db: DB): Promise<string[]> {
	const [std, taught] = await Promise.all([
		db
			.select({ name: platformSubject.name })
			.from(platformSubject)
			.orderBy(asc(platformSubject.sortOrder)),
		allSubjectNames(db)
	]);
	const seen = new Set<string>();
	return [...taught, ...std.map((x) => x.name)].filter((n) => {
		const k = n.toLowerCase();
		if (seen.has(k)) return false;
		seen.add(k);
		return true;
	});
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
	reviews: { displayName: string; rating: number; text: string; reply: string | null }[];
	/** average of the visible reviews, or null when there are none */
	rating: number | null;
	offersIntro: boolean;
	/** weekly free times, Zimbabwe time */
	times: { weekday: number; startMinute: number; endMinute: number }[];
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
			.select({
				displayName: review.displayName,
				rating: review.rating,
				text: review.text,
				reply: review.reply
			})
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
		rating: reviews.length
			? Math.round((reviews.reduce((a, r) => a + r.rating, 0) / reviews.length) * 10) / 10
			: null,
		offersIntro: s.offersIntro,
		times: (await listAvailability(db, tutorId)).map((t) => ({
			weekday: t.weekday,
			startMinute: t.startMinute,
			endMinute: t.endMinute
		})),
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
		note: s.paymentNote,
		cash: s.acceptsCash
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
