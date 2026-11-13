/**
 * Student profiles and Study Buddies: all permission rules live here.
 *
 * - Students connect ONLY with a one-time buddy code. There is no search and no suggestions.
 * - Children (under 18) only connect with children; adults only with adults.
 * - Under 13: each child's parent must approve the buddy before it becomes active.
 *   If the age is unknown for a child account, we treat them as under 13 (safer).
 * - 13–17: the parent is told and can remove buddies.
 * - A buddy sees only: photo (once checked), display name, grade, bio (once checked),
 *   subjects, streak and badges. Never school, age, birthday, contacts, results or check-ins.
 * - Messages are preset encouragements only.
 */
import { and, desc, eq, gt, gte, inArray, isNull, or, sql } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { user } from './db/auth.schema.ts';
import { homework, homeworkAnswer, profile } from './db/app.schema.ts';
import { assessmentResult, familyLink, studySession } from './db/v3.schema.ts';
import {
	buddyBlock,
	buddyCode,
	buddyLink,
	buddyMessage,
	buddyReport,
	studentCard,
	type Moderation
} from './db/buddies.schema.ts';
import { activeDays, streak } from './study.ts';
import { READY_PCT, topicScores } from './progress.ts';
import { addDays, localDate, startOfLocalDay } from '../tz.ts';

/* ------------------------------------------------------------------ constants */

export const BIO_MAX = 150;
export const GOALS_MAX = 200;
export const CODE_DAYS = 7;
export const MESSAGES_PER_DAY = 10;
export const PRESETS = [
	'good_luck',
	'study_at_4',
	'well_done',
	'keep_going',
	'you_can',
	'test_tip'
] as const;
export type Preset = (typeof PRESETS)[number];
export const BADGES = [
	'first_session',
	'sessions_10',
	'streak_3',
	'streak_7',
	'first_check',
	'topic_mastered',
	'homework_5'
] as const;
export type Badge = (typeof BADGES)[number];

/** Result codes are message keys the routes translate. */
export type BuddyFail =
	| 'buddy_code_bad'
	| 'buddy_self'
	| 'buddy_already'
	| 'buddy_age_mismatch'
	| 'buddy_need_parent'
	| 'buddy_other_need_parent'
	| 'buddy_not_allowed';

/** Who to tell, and what (the route turns the key into words). */
export interface Notice {
	userId: string;
	key:
		| 'bn_request_parent' // a child under 13 wants a buddy: please approve
		| 'bn_added_parent' // a 13–17 year old added a buddy
		| 'bn_new' // you have a new study buddy
		| 'bn_waiting' // waiting for a parent to approve
		| 'bn_approved' // a parent approved: you're now buddies
		| 'bn_declined' // a parent said no: the link was removed
		| 'bn_report'; // owner: a new report or item to check
	values: Record<string, string>;
	link: string;
}

/* ------------------------------------------------------------------ helpers */

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function makeBuddyCode(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(10));
	let r = '';
	for (let i = 0; i < 10; i++) {
		let b = bytes[i];
		while (b >= 248) b = crypto.getRandomValues(new Uint8Array(1))[0];
		r += ALPHABET[b % ALPHABET.length];
	}
	return `${r.slice(0, 5)}-${r.slice(5)}`;
}
export const normalizeCode = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Whole years between a birth date (YYYY-MM-DD) and today (Zimbabwe dates). */
export function ageOn(birthDate: string, now = new Date()): number {
	const [by, bm, bd] = birthDate.split('-').map(Number);
	const [ty, tm, td] = localDate(now).split('-').map(Number);
	let age = ty - by;
	if (tm < bm || (tm === bm && td < bd)) age--;
	return age;
}

/** "Amina Dube" → "Amina D." */
export function defaultDisplayName(full: string): string {
	const parts = full.trim().split(/\s+/).filter(Boolean);
	if (!parts.length) return '';
	return parts.length > 1 ? `${parts[0]} ${parts.at(-1)![0].toUpperCase()}.` : parts[0];
}
/** First name and one initial only, letters, hyphens and apostrophes. */
export const DISPLAY_NAME = /^[\p{L}][\p{L}'-]{0,23}( [\p{Lu}]\.)?$/u;

export type AgeBand = 'under13' | 'teen' | 'adult';

/** The age rule that applies to a student. Unknown age on a child account counts as under 13. */
export async function ageBand(db: DB, userId: string, now = new Date()): Promise<AgeBand> {
	const [[card], [prof]] = await Promise.all([
		db
			.select({ birthDate: studentCard.birthDate })
			.from(studentCard)
			.where(eq(studentCard.userId, userId)),
		db
			.select({ under18: profile.isUnder18, managed: profile.managed })
			.from(profile)
			.where(eq(profile.userId, userId))
	]);
	// The account's own flags win over a typed birthday in the safe direction:
	// - a child account (under 18 or parent-managed) can never become 'adult' by typing a date;
	//   if the date says adult, it is treated as under 13 (needs a parent's approval);
	// - an adult account can never become a 'teen' or 'under13' by typing a recent date, so
	//   adults can never reach children through Study Buddies.
	const minorAccount = !!(prof?.managed || prof?.under18);
	if (!minorAccount) return 'adult';
	if (card?.birthDate) {
		const a = ageOn(card.birthDate, now);
		if (a < 13) return 'under13';
		if (a < 18) return 'teen';
	}
	return 'under13';
}

const isMinor = (b: AgeBand) => b !== 'adult';

async function parentsOf(db: DB, studentId: string) {
	const rows = await db
		.select({ parentId: familyLink.parentId })
		.from(familyLink)
		.where(and(eq(familyLink.studentId, studentId), eq(familyLink.status, 'active')));
	return rows.map((r) => r.parentId);
}

/**
 * Who may approve a buddy for a child under 13: the child's guardians when there are any,
 * otherwise any connected parent (a parent who joined with the child's own code).
 */
async function approversOf(db: DB, studentId: string) {
	const rows = await db
		.select({ parentId: familyLink.parentId, guardian: familyLink.guardian })
		.from(familyLink)
		.where(and(eq(familyLink.studentId, studentId), eq(familyLink.status, 'active')));
	const g = rows.filter((r) => r.guardian);
	return (g.length ? g : rows).map((r) => r.parentId);
}

async function isStudent(db: DB, id: string) {
	const [u] = await db.select({ role: user.role }).from(user).where(eq(user.id, id));
	return u?.role === 'student';
}

export async function isBlocked(db: DB, a: string, b: string) {
	const rows = await db
		.select({ x: buddyBlock.blockerId })
		.from(buddyBlock)
		.where(
			or(
				and(eq(buddyBlock.blockerId, a), eq(buddyBlock.blockedId, b)),
				and(eq(buddyBlock.blockerId, b), eq(buddyBlock.blockedId, a))
			)
		);
	return rows.length > 0;
}

const pair = (x: string, y: string) => (x < y ? [x, y] : [y, x]) as [string, string];

async function linkBetween(db: DB, x: string, y: string) {
	const [a, b] = pair(x, y);
	const [row] = await db
		.select()
		.from(buddyLink)
		.where(and(eq(buddyLink.aId, a), eq(buddyLink.bId, b)));
	return row ?? null;
}

/** True when the two students are active buddies (and neither has blocked the other). */
export async function areBuddies(db: DB, x: string, y: string) {
	if (x === y) return false;
	const l = await linkBetween(db, x, y);
	return l?.status === 'active' && !(await isBlocked(db, x, y));
}

/* ------------------------------------------------------------------ profile */

export async function getCard(db: DB, userId: string) {
	const [card] = await db.select().from(studentCard).where(eq(studentCard.userId, userId));
	return card ?? null;
}

export interface CardInput {
	displayName: string;
	bio: string;
	grade: string;
	school: string;
	subjects: string[];
	favouriteSubject: string;
	goals: string;
	birthDate: string;
}

/** Saves the student's own profile. A changed bio waits for the owner's check. */
export async function saveCard(
	db: DB,
	userId: string,
	v: CardInput,
	now = new Date()
): Promise<{ ok: true } | { ok: false; error: string }> {
	const displayName = v.displayName.trim().replace(/\s+/g, ' ');
	if (!DISPLAY_NAME.test(displayName)) return { ok: false, error: 'pf_err_display' };
	const bio = v.bio.trim();
	if (bio.length > BIO_MAX) return { ok: false, error: 'pf_err_bio' };
	const goals = v.goals.trim();
	if (goals.length > GOALS_MAX) return { ok: false, error: 'pf_err_goals' };
	let birthDate: string | null = v.birthDate.trim() || null;
	if (birthDate) {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || Number.isNaN(Date.parse(birthDate)))
			return { ok: false, error: 'pf_err_birth' };
		const age = ageOn(birthDate, now);
		if (age < 4 || age > 100) return { ok: false, error: 'pf_err_birth' };
	}
	const subjects = [
		...new Map(
			v.subjects
				.map((s) => s.trim().slice(0, 40))
				.filter(Boolean)
				.map((s) => [s.toLowerCase(), s] as const)
		).values()
	].slice(0, 12);
	const fav = v.favouriteSubject.trim().slice(0, 40);
	const old = await getCard(db, userId);
	// once a birthday is saved, only the owner can change it (stops a child "ageing up")
	if (old?.birthDate && birthDate !== old.birthDate) birthDate = old.birthDate;
	const bioChanged = (old?.bio ?? '') !== bio;
	const row = {
		displayName,
		bio: bio || null,
		bioStatus: (bio
			? bioChanged
				? 'pending'
				: (old?.bioStatus ?? 'pending')
			: 'none') as Moderation,
		grade: v.grade.trim().slice(0, 40) || null,
		school: v.school.trim().slice(0, 80) || null,
		subjects,
		favouriteSubject:
			fav && subjects.some((s) => s.toLowerCase() === fav.toLowerCase()) ? fav : null,
		goals: goals || null,
		birthDate,
		updatedAt: now
	};
	await db
		.insert(studentCard)
		.values({ userId, ...row })
		.onConflictDoUpdate({ target: studentCard.userId, set: row });
	return { ok: true };
}

/** A new photo (already cropped, compressed and stripped by the caller) waits for a check. */
export async function setPhoto(db: DB, userId: string, key: string | null) {
	const old = await getCard(db, userId);
	const values = {
		photoKey: key,
		photoStatus: (key ? 'pending' : 'none') as Moderation,
		photoVersion: (old?.photoVersion ?? 0) + 1
	};
	await db
		.insert(studentCard)
		.values({ userId, ...values })
		.onConflictDoUpdate({ target: studentCard.userId, set: values });
	return old?.photoKey ?? null;
}

/** Badges earned from real activity only. */
export async function badgesFor(db: DB, userId: string, now = new Date()): Promise<Badge[]> {
	const [[sessions], [checks], [hw], days, topics] = await Promise.all([
		db
			.select({ n: sql<number>`count(*)::int` })
			.from(studySession)
			.where(and(eq(studySession.studentId, userId), eq(studySession.status, 'done'))),
		db
			.select({ n: sql<number>`count(*)::int` })
			.from(assessmentResult)
			.where(
				and(eq(assessmentResult.studentId, userId), eq(assessmentResult.source, 'daily_check'))
			),
		db
			.select({ n: sql<number>`count(distinct ${homeworkAnswer.homeworkId})::int` })
			.from(homeworkAnswer)
			.innerJoin(homework, eq(homework.id, homeworkAnswer.homeworkId))
			.where(eq(homework.userId, userId)),
		activeDays(db, userId, addDays(startOfLocalDay(now), -365)),
		topicScores(db, userId)
	]);
	// longest run of consecutive active days in the last year
	const sorted = [...days].sort();
	let best = 0;
	let run = 0;
	let prev = '';
	for (const d of sorted) {
		run = prev && localDate(addDays(new Date(`${prev}T12:00:00Z`), 1)) === d ? run + 1 : 1;
		best = Math.max(best, run);
		prev = d;
	}
	const out: Badge[] = [];
	if (sessions.n >= 1) out.push('first_session');
	if (sessions.n >= 10) out.push('sessions_10');
	if (best >= 3) out.push('streak_3');
	if (best >= 7) out.push('streak_7');
	if (checks.n >= 1) out.push('first_check');
	if (topics.some((t) => t.pct >= READY_PCT)) out.push('topic_mastered');
	if (hw.n >= 5) out.push('homework_5');
	return out;
}

/** Everything the student sees on their OWN profile (private fields included). */
export async function ownProfile(db: DB, userId: string, now = new Date()) {
	const [u] = await db.select({ name: user.name }).from(user).where(eq(user.id, userId));
	const [[prof], card, days, badges] = await Promise.all([
		db.select({ level: profile.level }).from(profile).where(eq(profile.userId, userId)),
		getCard(db, userId),
		streak(db, userId, now),
		badgesFor(db, userId, now)
	]);
	return {
		displayName: card?.displayName || defaultDisplayName(u?.name ?? ''),
		bio: card?.bio ?? null,
		bioStatus: card?.bioStatus ?? 'none',
		grade: card?.grade || prof?.level || null,
		school: card?.school ?? null,
		subjects: card?.subjects ?? [],
		favouriteSubject: card?.favouriteSubject ?? null,
		goals: card?.goals ?? null,
		birthDate: card?.birthDate ?? null,
		age: card?.birthDate ? ageOn(card.birthDate, now) : null,
		photoVersion: card?.photoKey ? card.photoVersion : 0,
		photoStatus: card?.photoStatus ?? 'none',
		streak: days,
		badges
	};
}

/**
 * What a BUDDY may see: a fixed whitelist. Returns null unless the viewer and the student are
 * active buddies. School, age, birthday, contacts, results and check-ins are never included.
 */
export async function buddyView(db: DB, viewerId: string, otherId: string, now = new Date()) {
	if (!(await areBuddies(db, viewerId, otherId))) return null;
	const p = await ownProfile(db, otherId, now);
	return {
		id: otherId,
		displayName: p.displayName,
		grade: p.grade,
		bio: p.bioStatus === 'approved' ? p.bio : null,
		subjects: p.subjects,
		streak: p.streak,
		badges: p.badges,
		photoVersion: p.photoStatus === 'approved' ? p.photoVersion : 0
	};
}
export type BuddyCardView = NonNullable<Awaited<ReturnType<typeof buddyView>>>;

/** Who may load a student's profile photo. Buddies only see a checked photo. */
export async function canSeePhoto(
	db: DB,
	viewer: { id: string; role: string } | undefined,
	studentId: string
): Promise<boolean> {
	if (!viewer) return false;
	if (viewer.id === studentId || viewer.role === 'owner') return true;
	const card = await getCard(db, studentId);
	if (!card?.photoKey) return false;
	if (viewer.role === 'parent') return (await parentsOf(db, studentId)).includes(viewer.id);
	if (viewer.role === 'student')
		return card.photoStatus === 'approved' && (await areBuddies(db, viewer.id, studentId));
	return false;
}

/* ------------------------------------------------------------------ codes and links */

/** The student's current code (made if none is waiting). One-time, 7 days. */
export async function myCode(db: DB, userId: string, now = new Date()) {
	const [c] = await db
		.select()
		.from(buddyCode)
		.where(
			and(eq(buddyCode.studentId, userId), isNull(buddyCode.usedAt), gt(buddyCode.expiresAt, now))
		)
		.orderBy(desc(buddyCode.createdAt))
		.limit(1);
	if (c) return { code: `${c.code.slice(0, 5)}-${c.code.slice(5)}`, expiresAt: c.expiresAt };
	return newCode(db, userId, now);
}
/** Throw away waiting codes and make a fresh one. */
export async function newCode(db: DB, userId: string, now = new Date()) {
	await db
		.update(buddyCode)
		.set({ usedAt: now })
		.where(and(eq(buddyCode.studentId, userId), isNull(buddyCode.usedAt)));
	const code = makeBuddyCode();
	const expiresAt = addDays(now, CODE_DAYS);
	await db.insert(buddyCode).values({ code: normalizeCode(code), studentId: userId, expiresAt });
	return { code, expiresAt };
}

/**
 * Connect with the owner of a buddy code. Same answer ("code not valid") for an unknown,
 * used, expired or blocked code, so codes can't be probed.
 */
export async function connectByCode(
	db: DB,
	userId: string,
	rawCode: string,
	names: { me: string; other?: string } = { me: '' },
	now = new Date()
): Promise<
	{ ok: true; status: 'active' | 'pending'; notices: Notice[] } | { ok: false; error: BuddyFail }
> {
	const code = normalizeCode(rawCode);
	if (code.length !== 10) return { ok: false, error: 'buddy_code_bad' };
	const [c] = await db.select().from(buddyCode).where(eq(buddyCode.code, code));
	if (!c || c.usedAt || c.expiresAt.getTime() <= now.getTime())
		return { ok: false, error: 'buddy_code_bad' };
	const other = c.studentId;
	if (other === userId) return { ok: false, error: 'buddy_self' };
	if (!(await isStudent(db, userId)) || !(await isStudent(db, other)))
		return { ok: false, error: 'buddy_not_allowed' };
	if (await isBlocked(db, userId, other)) return { ok: false, error: 'buddy_code_bad' };
	if (await linkBetween(db, userId, other)) return { ok: false, error: 'buddy_already' };
	const [mine, theirs] = await Promise.all([ageBand(db, userId, now), ageBand(db, other, now)]);
	if (isMinor(mine) !== isMinor(theirs)) return { ok: false, error: 'buddy_age_mismatch' };
	const [myParents, theirParents] = await Promise.all([
		parentsOf(db, userId),
		parentsOf(db, other)
	]);
	if (mine === 'under13' && !myParents.length) return { ok: false, error: 'buddy_need_parent' };
	if (theirs === 'under13' && !theirParents.length)
		return { ok: false, error: 'buddy_other_need_parent' };

	const [a, b] = pair(userId, other);
	const needA = (a === userId ? mine : theirs) === 'under13';
	const needB = (b === userId ? mine : theirs) === 'under13';
	const status = needA || needB ? 'pending' : 'active';
	const [link] = await db
		.insert(buddyLink)
		.values({ aId: a, bId: b, status, needParentA: needA, needParentB: needB })
		.returning();
	await db.update(buddyCode).set({ usedAt: now }).where(eq(buddyCode.code, code));

	const otherName = names.other ?? '';
	const notices: Notice[] = [];
	const tellParents = (
		child: string,
		band: AgeBand,
		parents: string[],
		childName: string,
		buddy: string
	) => {
		for (const p of parents) {
			if (band === 'under13')
				notices.push({
					userId: p,
					key: 'bn_request_parent',
					values: { child: childName, buddy },
					link: `/parent/buddies?child=${encodeURIComponent(child)}`
				});
			else if (band === 'teen')
				notices.push({
					userId: p,
					key: 'bn_added_parent',
					values: { child: childName, buddy },
					link: `/parent/buddies?child=${encodeURIComponent(child)}`
				});
		}
	};
	// an under-13 request goes to the people who can approve it (guardians first)
	const who = async (id: string, band: AgeBand, all: string[]) =>
		band === 'under13' ? approversOf(db, id) : all;
	tellParents(userId, mine, await who(userId, mine, myParents), names.me, otherName);
	tellParents(other, theirs, await who(other, theirs, theirParents), otherName, names.me);
	for (const s of [userId, other])
		notices.push({
			userId: s,
			key: status === 'active' ? 'bn_new' : 'bn_waiting',
			values: { buddy: s === userId ? otherName : names.me },
			link: `/student/buddies`
		});
	void link;
	return { ok: true, status, notices };
}

/** A parent approves (or declines) a pending buddy for their own child under 13. */
export async function parentDecide(
	db: DB,
	parentId: string,
	linkId: number,
	approve: boolean,
	now = new Date()
): Promise<{ ok: boolean; activated: boolean; notices: Notice[] }> {
	const [l] = await db.select().from(buddyLink).where(eq(buddyLink.id, linkId));
	if (!l || l.status !== 'pending') return { ok: false, activated: false, notices: [] };
	const side =
		(await approversOf(db, l.aId)).includes(parentId) && l.needParentA && !l.approvedA
			? 'a'
			: (await approversOf(db, l.bId)).includes(parentId) && l.needParentB && !l.approvedB
				? 'b'
				: null;
	if (!side) return { ok: false, activated: false, notices: [] };
	if (!approve) {
		await db.delete(buddyLink).where(eq(buddyLink.id, l.id));
		// both children learn it did not go ahead (no reason, no names of parents)
		return {
			ok: true,
			activated: false,
			notices: [l.aId, l.bId].map((s) => ({
				userId: s,
				key: 'bn_declined' as const,
				values: {},
				link: '/student/buddies'
			}))
		};
	}
	const approvedA = side === 'a' ? now : l.approvedA;
	const approvedB = side === 'b' ? now : l.approvedB;
	const done = (!l.needParentA || approvedA) && (!l.needParentB || approvedB);
	await db
		.update(buddyLink)
		.set({ approvedA, approvedB, status: done ? 'active' : 'pending' })
		.where(eq(buddyLink.id, l.id));
	return {
		ok: true,
		activated: !!done,
		notices: done
			? [l.aId, l.bId].map((s) => ({
					userId: s,
					key: 'bn_approved' as const,
					values: {},
					link: '/student/buddies'
				}))
			: []
	};
}

/** Either student, or a parent of either student, can end a buddy link. */
export async function removeBuddy(db: DB, actorId: string, linkId: number) {
	const [l] = await db.select().from(buddyLink).where(eq(buddyLink.id, linkId));
	if (!l) return false;
	const allowed =
		actorId === l.aId ||
		actorId === l.bId ||
		(await parentsOf(db, l.aId)).includes(actorId) ||
		(await parentsOf(db, l.bId)).includes(actorId);
	if (!allowed) return false;
	await db.delete(buddyLink).where(eq(buddyLink.id, l.id));
	return true;
}

/** Block: ends the link and stops new links and messages either way. */
export async function blockStudent(db: DB, blockerId: string, otherId: string) {
	if (blockerId === otherId || !(await isStudent(db, otherId))) return false;
	await db.insert(buddyBlock).values({ blockerId, blockedId: otherId }).onConflictDoNothing();
	const l = await linkBetween(db, blockerId, otherId);
	if (l) await db.delete(buddyLink).where(eq(buddyLink.id, l.id));
	return true;
}

/** The student's buddies (active, with the buddy view) and links waiting for a parent. */
export async function listBuddies(db: DB, userId: string, now = new Date()) {
	const links = await db
		.select()
		.from(buddyLink)
		.where(or(eq(buddyLink.aId, userId), eq(buddyLink.bId, userId)));
	const active: (BuddyCardView & { linkId: number })[] = [];
	const pending: { linkId: number; displayName: string; waitingForMine: boolean }[] = [];
	for (const l of links) {
		const other = l.aId === userId ? l.bId : l.aId;
		if (await isBlocked(db, userId, other)) continue;
		if (l.status === 'active') {
			const v = await buddyView(db, userId, other, now);
			if (v) active.push({ ...v, linkId: l.id });
		} else {
			const [u] = await db.select({ name: user.name }).from(user).where(eq(user.id, other));
			const card = await getCard(db, other);
			const mineSide = l.aId === userId ? 'a' : 'b';
			pending.push({
				linkId: l.id,
				displayName: card?.displayName || defaultDisplayName(u?.name ?? ''),
				waitingForMine:
					mineSide === 'a' ? l.needParentA && !l.approvedA : l.needParentB && !l.approvedB
			});
		}
	}
	return { active, pending };
}

/** A parent's view of their child's buddies (Family Connection). Null if not their child. */
export async function parentBuddyList(db: DB, parentId: string, childId: string) {
	if (!(await parentsOf(db, childId)).includes(parentId)) return null;
	const links = await db
		.select()
		.from(buddyLink)
		.where(or(eq(buddyLink.aId, childId), eq(buddyLink.bId, childId)));
	const out: {
		linkId: number;
		displayName: string;
		grade: string | null;
		status: 'active' | 'pending';
		needsMe: boolean;
	}[] = [];
	const canApprove = (await approversOf(db, childId)).includes(parentId);
	for (const l of links) {
		const other = l.aId === childId ? l.bId : l.aId;
		const [u] = await db.select({ name: user.name }).from(user).where(eq(user.id, other));
		const [prof] = await db
			.select({ level: profile.level })
			.from(profile)
			.where(eq(profile.userId, other));
		const card = await getCard(db, other);
		const childSide = l.aId === childId ? 'a' : 'b';
		out.push({
			linkId: l.id,
			displayName: card?.displayName || defaultDisplayName(u?.name ?? ''),
			grade: card?.grade || prof?.level || null,
			status: l.status,
			needsMe:
				canApprove &&
				l.status === 'pending' &&
				(childSide === 'a' ? l.needParentA && !l.approvedA : l.needParentB && !l.approvedB)
		});
	}
	return out;
}

/* ------------------------------------------------------------------ messages */

export const isPreset = (v: unknown): v is Preset => PRESETS.includes(v as Preset);

/** Send one preset encouragement to an active buddy (at most 10 a day to the same buddy). */
export async function sendPreset(
	db: DB,
	fromId: string,
	toId: string,
	preset: string,
	now = new Date()
) {
	if (!isPreset(preset)) return { ok: false as const, error: 'buddy_not_allowed' };
	if (!(await areBuddies(db, fromId, toId)))
		return { ok: false as const, error: 'buddy_not_allowed' };
	const [n] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(buddyMessage)
		.where(
			and(
				eq(buddyMessage.fromId, fromId),
				eq(buddyMessage.toId, toId),
				gte(buddyMessage.createdAt, addDays(now, -1))
			)
		);
	if (n.n >= MESSAGES_PER_DAY) return { ok: false as const, error: 'buddy_too_many' };
	await db.insert(buddyMessage).values({ fromId, toId, preset, createdAt: now });
	return { ok: true as const };
}

/** The last encouragements between two buddies (both directions). */
export async function messagesBetween(db: DB, me: string, other: string, limit = 10) {
	if (!(await areBuddies(db, me, other))) return [];
	return db
		.select({
			fromMe: sql<boolean>`${buddyMessage.fromId} = ${me}`,
			preset: buddyMessage.preset,
			at: buddyMessage.createdAt
		})
		.from(buddyMessage)
		.where(
			or(
				and(eq(buddyMessage.fromId, me), eq(buddyMessage.toId, other)),
				and(eq(buddyMessage.fromId, other), eq(buddyMessage.toId, me))
			)
		)
		.orderBy(desc(buddyMessage.createdAt))
		.limit(limit);
}

/* ------------------------------------------------------------------ reports and checks */

/**
 * Report another student (only someone you are or were linked with, or blocked).
 * A reported photo or bio is hidden again until the owner checks it.
 */
export async function reportStudent(
	db: DB,
	reporterId: string,
	reportedId: string,
	what: 'photo' | 'bio' | 'behaviour' | 'other',
	note: string
) {
	if (reporterId === reportedId) return false;
	const known =
		(await linkBetween(db, reporterId, reportedId)) ||
		(
			await db
				.select({ x: buddyBlock.blockerId })
				.from(buddyBlock)
				.where(and(eq(buddyBlock.blockerId, reporterId), eq(buddyBlock.blockedId, reportedId)))
		).length;
	if (!known) return false;
	await db
		.insert(buddyReport)
		.values({ reporterId, reportedId, what, note: note.trim().slice(0, 300) || null });
	if (what === 'photo')
		await db
			.update(studentCard)
			.set({ photoStatus: 'pending' })
			.where(and(eq(studentCard.userId, reportedId), eq(studentCard.photoStatus, 'approved')));
	if (what === 'bio')
		await db
			.update(studentCard)
			.set({ bioStatus: 'pending' })
			.where(and(eq(studentCard.userId, reportedId), eq(studentCard.bioStatus, 'approved')));
	return true;
}

/** The owner's queue: photos and bios waiting for a check, and open reports. */
export async function moderationQueue(db: DB) {
	const cards = await db
		.select({
			userId: studentCard.userId,
			displayName: studentCard.displayName,
			bio: studentCard.bio,
			bioStatus: studentCard.bioStatus,
			photoStatus: studentCard.photoStatus,
			photoVersion: studentCard.photoVersion,
			name: user.name
		})
		.from(studentCard)
		.innerJoin(user, eq(user.id, studentCard.userId))
		.where(or(eq(studentCard.photoStatus, 'pending'), eq(studentCard.bioStatus, 'pending')));
	const reports = await db
		.select()
		.from(buddyReport)
		.where(eq(buddyReport.status, 'open'))
		.orderBy(desc(buddyReport.createdAt));
	const ids = [...new Set(reports.flatMap((r) => [r.reporterId, r.reportedId]))];
	const names = ids.length
		? await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, ids))
		: [];
	const nameOf = (id: string) => names.find((n) => n.id === id)?.name ?? '';
	return {
		cards,
		reports: reports.map((r) => ({
			id: r.id,
			what: r.what,
			note: r.note,
			createdAt: r.createdAt,
			reporter: nameOf(r.reporterId),
			reportedId: r.reportedId,
			reported: nameOf(r.reportedId)
		}))
	};
}

/** The owner approves or rejects a photo or bio. A rejected photo is removed. */
export async function moderate(
	db: DB,
	studentId: string,
	what: 'photo' | 'bio',
	approve: boolean
): Promise<string | null> {
	const card = await getCard(db, studentId);
	if (!card) return null;
	if (what === 'bio') {
		await db
			.update(studentCard)
			.set({ bioStatus: approve ? 'approved' : 'rejected' })
			.where(eq(studentCard.userId, studentId));
		return null;
	}
	if (approve) {
		await db
			.update(studentCard)
			.set({ photoStatus: 'approved' })
			.where(eq(studentCard.userId, studentId));
		return null;
	}
	await db
		.update(studentCard)
		.set({ photoStatus: 'rejected', photoKey: null, photoVersion: card.photoVersion + 1 })
		.where(eq(studentCard.userId, studentId));
	return card.photoKey; // the caller deletes the file
}

export async function resolveReport(db: DB, ownerId: string, reportId: number, now = new Date()) {
	await db
		.update(buddyReport)
		.set({ status: 'resolved', resolvedBy: ownerId, resolvedAt: now })
		.where(eq(buddyReport.id, reportId));
}
