/**
 * "Tutora recommended tutors" (Tutora Family): for each child, 3–5 approved tutors who teach
 * the child's school subjects at the child's level, ordered by rating, then approved by the
 * Tutora team ("verified"), then open lesson times. The owner can pin a tutor (shown first
 * when they match) or hide one (never shown). Tutors cannot choose or pay for this: there is
 * no tutor-facing setting and no paid boost.
 *
 * Light on CPU: the tutor pool (the "Find a tutor" list + approval + weekly hours + the
 * owner's pins) is kept in memory for 5 minutes; each page adds one batch for its children.
 */
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { profile, child, enrollment, availability, tutorProfile } from './db/app.schema.ts';
import { schoolInfo, schoolSubject } from './db/v3.schema.ts';
import { recommendPref, type RecommendMode } from './db/recommend.schema.ts';
import { listTutors, type TutorCard } from './settings.ts';
import { sharedFor, forgetShared } from './cache.ts';
import { childCovered } from './family-billing.ts';
import { audit } from './owner.ts';

export const REC_MAX = 5;
export const REC_MIN = 3;
const POOL_KEY = 'rec:pool';

export interface PoolTutor {
	tutorId: string;
	slug: string;
	name: string;
	hasPhoto: boolean;
	photoVersion: number;
	subjects: string[];
	levels: string[];
	rating: number | null;
	reviewCount: number;
	lessonCount: number;
	/** approved by the Tutora team after checks */
	verified: boolean;
	/** weekly hours the tutor has opened for lessons */
	weeklyHours: number;
	mode: RecommendMode | null;
}

export interface Recommended {
	slug: string;
	name: string;
	hasPhoto: boolean;
	photoVersion: number;
	/** the child's subjects this tutor teaches (or the tutor's own when the child has none yet) */
	subjects: string[];
	rating: number | null;
	reviewCount: number;
	verified: boolean;
	hasTimes: boolean;
	pinned: boolean;
}

export interface ChildNeeds {
	subjects: string[];
	level: string | null;
	/** tutors already teaching the child, and anyone else to leave out (e.g. the parent) */
	exclude: string[];
}

/* ------------------------------------------------------------------ matching */

/** Zimbabwe school levels in broad bands, so "Form 3" matches a tutor's "O Level". */
export function levelBands(raw: string | null | undefined): string[] {
	const s = (raw ?? '').toLowerCase();
	if (!s.trim()) return [];
	const out = new Set<string>();
	if (/\b(grade\s*[1-7]|primary|ecd)\b/.test(s)) out.add('primary');
	if (/\b(o[\s-]*level|ordinary|form\s*[1-4])\b/.test(s)) out.add('olevel');
	if (/\b(a[\s-]*level|advanced|form\s*[56]|lower\s*six|upper\s*six|l6|u6)\b/.test(s))
		out.add('alevel');
	if (/\b(universit|college|adult|tertiary)/.test(s)) out.add('higher');
	if (!out.size) out.add(s.trim());
	return [...out];
}

export function teachesLevel(tutorLevels: string[], childLevel: string | null): boolean {
	if (!childLevel) return true;
	if (!tutorLevels.length) return true;
	const want = levelBands(childLevel);
	const have = new Set(tutorLevels.flatMap((l) => levelBands(l)));
	return want.some((b) => have.has(b));
}

const norm = (s: string) => s.trim().toLowerCase();
const sameSubject = (a: string, b: string) => {
	const x = norm(a);
	const y = norm(b);
	return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
};

/** Pure: pick and order up to REC_MAX tutors for one child. */
export function rankFor(pool: PoolTutor[], needs: ChildNeeds, max = REC_MAX): Recommended[] {
	const exclude = new Set(needs.exclude);
	const scored = pool
		.filter((t) => t.mode !== 'hidden' && !exclude.has(t.tutorId))
		.filter((t) => teachesLevel(t.levels, needs.level))
		.map((t) => {
			const matched = needs.subjects.length
				? t.subjects.filter((s) => needs.subjects.some((c) => sameSubject(s, c)))
				: [];
			return { t, matched };
		})
		// with known school subjects, a tutor must teach at least one of them
		.filter((x) => !needs.subjects.length || x.matched.length > 0);
	scored.sort(
		(a, b) =>
			Number(b.t.mode === 'pinned') - Number(a.t.mode === 'pinned') ||
			b.matched.length - a.matched.length ||
			(b.t.rating ?? 0) - (a.t.rating ?? 0) ||
			b.t.reviewCount - a.t.reviewCount ||
			Number(b.t.verified) - Number(a.t.verified) ||
			Number(b.t.weeklyHours > 0) - Number(a.t.weeklyHours > 0) ||
			b.t.weeklyHours - a.t.weeklyHours ||
			b.t.lessonCount - a.t.lessonCount ||
			a.t.name.localeCompare(b.t.name)
	);
	return scored.slice(0, max).map(({ t, matched }) => ({
		slug: t.slug,
		name: t.name,
		hasPhoto: t.hasPhoto,
		photoVersion: t.photoVersion,
		subjects: (matched.length ? matched : t.subjects).slice(0, 3),
		rating: t.rating,
		reviewCount: t.reviewCount,
		verified: t.verified,
		hasTimes: t.weeklyHours > 0,
		pinned: t.mode === 'pinned'
	}));
}

/* ------------------------------------------------------------------ data */

async function poolFresh(db: DB): Promise<PoolTutor[]> {
	const [cards, extra, hours, prefs] = await Promise.all([
		listTutors(db),
		db
			.select({ tutorId: tutorProfile.tutorId, approvedAt: tutorProfile.approvedAt })
			.from(tutorProfile)
			.where(eq(tutorProfile.status, 'active')),
		db
			.select({
				tutorId: availability.tutorId,
				minutes: sql<number>`sum(${availability.endMinute} - ${availability.startMinute})::int`
			})
			.from(availability)
			.groupBy(availability.tutorId),
		db.select({ tutorId: recommendPref.tutorId, mode: recommendPref.mode }).from(recommendPref)
	]);
	const approved = new Map(extra.map((x) => [x.tutorId, !!x.approvedAt]));
	const mins = new Map(hours.map((h) => [h.tutorId, Number(h.minutes) || 0]));
	const mode = new Map(prefs.map((p) => [p.tutorId, p.mode]));
	return cards.map((c: TutorCard) => ({
		tutorId: c.tutorId,
		slug: c.slug,
		name: c.name,
		hasPhoto: c.hasPhoto,
		photoVersion: c.photoVersion,
		subjects: c.subjects,
		levels: c.levels,
		rating: c.rating,
		reviewCount: c.reviewCount,
		lessonCount: c.lessonCount,
		verified: approved.get(c.tutorId) ?? false,
		weeklyHours: Math.round(((mins.get(c.tutorId) ?? 0) / 60) * 10) / 10,
		mode: mode.get(c.tutorId) ?? null
	}));
}

/** Approved tutors with what ranking needs (kept for 5 minutes in this worker). */
export const recommendPool = (db: DB) => sharedFor(POOL_KEY, 5 * 60_000, () => poolFresh(db));

/** What each child needs: school subjects, level, tutors they already have. One batch. */
export async function childNeeds(
	db: DB,
	parentId: string,
	childIds: string[]
): Promise<Map<string, ChildNeeds>> {
	const out = new Map<string, ChildNeeds>();
	if (!childIds.length) return out;
	const [levels, years, kidRows, subs, has] = await Promise.all([
		db
			.select({ id: profile.userId, level: profile.level })
			.from(profile)
			.where(inArray(profile.userId, childIds)),
		db
			.select({ id: schoolInfo.studentId, year: schoolInfo.year })
			.from(schoolInfo)
			.where(inArray(schoolInfo.studentId, childIds)),
		db
			.select({ id: child.studentId, level: child.level, year: child.schoolYear })
			.from(child)
			.where(and(eq(child.parentId, parentId), inArray(child.studentId, childIds))),
		db
			.select({ id: schoolSubject.studentId, subject: schoolSubject.subject })
			.from(schoolSubject)
			.where(inArray(schoolSubject.studentId, childIds)),
		db
			.select({ id: enrollment.userId, tutorId: enrollment.tutorId })
			.from(enrollment)
			.where(inArray(enrollment.userId, childIds))
	]);
	for (const id of childIds) {
		const level =
			levels.find((r) => r.id === id)?.level ||
			years.find((r) => r.id === id)?.year ||
			kidRows.find((r) => r.id === id)?.level ||
			kidRows.find((r) => r.id === id)?.year ||
			null;
		out.set(id, {
			level,
			subjects: [...new Set(subs.filter((s) => s.id === id).map((s) => s.subject))],
			// never recommend a tutor the child already has, nor the parent themselves
			exclude: [...has.filter((h) => h.id === id).map((h) => h.tutorId), parentId]
		});
	}
	return out;
}

export type ChildRecommendations =
	| { locked: false; tutors: Recommended[]; hasSubjects: boolean }
	/** free level: a teaser only (how many there would be), never names */
	| { locked: true; count: number };

/** Recommendations per child, for the parent pages. Family plan only, per child. */
export async function recommendationsFor(
	db: DB,
	parentId: string,
	childIds: string[]
): Promise<Map<string, ChildRecommendations>> {
	const out = new Map<string, ChildRecommendations>();
	if (!childIds.length) return out;
	const [pool, needs, access] = await Promise.all([
		recommendPool(db),
		childNeeds(db, parentId, childIds),
		Promise.all(childIds.map((id) => childCovered(db, parentId, id)))
	]);
	childIds.forEach((id, i) => {
		const n = needs.get(id) ?? { subjects: [], level: null, exclude: [parentId] };
		const list = rankFor(pool, n);
		out.set(
			id,
			access[i]
				? { locked: false, tutors: list, hasSubjects: n.subjects.length > 0 }
				: { locked: true, count: Math.max(REC_MIN, list.length) }
		);
	});
	return out;
}

/* ------------------------------------------------------------------ owner */

export class RecommendFail extends Error {
	constructor(public code: string) {
		super(code);
	}
}

/** The owner pins, hides or clears a tutor in recommendations (logged). */
export async function setRecommendMode(
	db: DB,
	ownerId: string,
	tutorId: string,
	mode: RecommendMode | 'normal'
) {
	const [t] = await db
		.select({ id: tutorProfile.tutorId, name: tutorProfile.tutorName })
		.from(tutorProfile)
		.where(eq(tutorProfile.tutorId, tutorId));
	if (!t) throw new RecommendFail('rec_err_tutor');
	if (mode === 'normal') await db.delete(recommendPref).where(eq(recommendPref.tutorId, tutorId));
	else
		await db
			.insert(recommendPref)
			.values({ tutorId, mode, setBy: ownerId, setAt: new Date() })
			.onConflictDoUpdate({
				target: recommendPref.tutorId,
				set: { mode, setBy: ownerId, setAt: new Date() }
			});
	await audit(db, ownerId, `recommend_${mode}`, tutorId, t.name ?? null);
	forgetShared(POOL_KEY);
}

/** tutorId → pinned / hidden, for the owner's tutor list. */
export async function recommendModes(db: DB): Promise<Map<string, RecommendMode>> {
	const rows = await db
		.select({ tutorId: recommendPref.tutorId, mode: recommendPref.mode })
		.from(recommendPref);
	return new Map(rows.map((r) => [r.tutorId, r.mode]));
}
