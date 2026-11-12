/**
 * Family Connection: students invite parents with one-time codes; parents follow one or more
 * children and see only what each child shares. Every rule is enforced here on the server.
 */
import { shortName } from '../names.ts';
import { and, asc, desc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { familyInvite, familyLink, guardianPermission, partnership } from './db/v3.schema.ts';
import { profile } from './db/app.schema.ts';
import { user } from './db/auth.schema.ts';

export const INVITE_HOURS = 48;
/** No 0/O, 1/I/L: easy to read out over the phone. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const RANDOM_LEN = 6;

export class FamilyFail extends Error {
	constructor(public code: string) {
		super(code);
	}
}

/** Same rules for typing a code: ignore case, spaces and dashes. */
export function normalizeInvite(code: string): string {
	return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export async function sha256Hex(text: string): Promise<string> {
	const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** First three letters of the name (A–Z only), padded: "Amina" → "AMI". */
export function namePrefix(name: string): string {
	const letters = name
		.normalize('NFD')
		.toUpperCase()
		.replace(/[^A-Z]/g, '');
	return (letters + 'TUT').slice(0, 3);
}

/** A new code such as "AMI-7KQ49P": 3 letters of the name + 6 random characters (31^6). */
export function makeInviteCode(name: string): string {
	const bytes = crypto.getRandomValues(new Uint8Array(RANDOM_LEN));
	let r = '';
	// 256 % 31 bias is tiny (<1%), but reject-and-retry keeps it uniform
	for (let i = 0; i < RANDOM_LEN; i++) {
		let b = bytes[i];
		while (b >= 248) b = crypto.getRandomValues(new Uint8Array(1))[0];
		r += ALPHABET[b % ALPHABET.length];
	}
	return `${namePrefix(name)}-${r}`;
}

/* ---------------------------------------------------------------- invites (student side) */

/** Makes a new code and revokes any unused one: at most one code works at a time. */
export async function createInvite(db: DB, studentId: string, now = new Date()) {
	const [s] = await db
		.select({ name: user.name, role: user.role })
		.from(user)
		.where(eq(user.id, studentId));
	if (!s || s.role !== 'student') throw new FamilyFail('err_not_found');
	const code = makeInviteCode(s.name);
	const plain = normalizeInvite(code);
	const expiresAt = new Date(now.getTime() + INVITE_HOURS * 3_600_000);
	await db.transaction(async (tx) => {
		await tx
			.update(familyInvite)
			.set({ revokedAt: now })
			.where(
				and(
					eq(familyInvite.studentId, studentId),
					isNull(familyInvite.usedAt),
					isNull(familyInvite.revokedAt)
				)
			);
		await tx.insert(familyInvite).values({
			studentId,
			codeHash: await sha256Hex(plain),
			hint: plain.slice(0, 3),
			expiresAt
		});
	});
	return { code, expiresAt };
}

export async function revokeInvites(db: DB, studentId: string, now = new Date()) {
	await db
		.update(familyInvite)
		.set({ revokedAt: now })
		.where(
			and(
				eq(familyInvite.studentId, studentId),
				isNull(familyInvite.usedAt),
				isNull(familyInvite.revokedAt)
			)
		);
}

/** The student's code that still works (the code itself is only shown when it is made). */
export async function activeInvite(db: DB, studentId: string, now = new Date()) {
	const [row] = await db
		.select({ id: familyInvite.id, hint: familyInvite.hint, expiresAt: familyInvite.expiresAt })
		.from(familyInvite)
		.where(
			and(
				eq(familyInvite.studentId, studentId),
				isNull(familyInvite.usedAt),
				isNull(familyInvite.revokedAt),
				gt(familyInvite.expiresAt, now)
			)
		)
		.orderBy(desc(familyInvite.createdAt))
		.limit(1);
	return row ?? null;
}

/* ---------------------------------------------------------------- redeeming (parent side) */

async function inviteByCode(db: DB, code: string, now: Date, lock = false) {
	const plain = normalizeInvite(code);
	if (plain.length !== 3 + RANDOM_LEN) return null;
	const q = db
		.select()
		.from(familyInvite)
		.where(eq(familyInvite.codeHash, await sha256Hex(plain)));
	const [inv] = lock ? await q.for('update') : await q;
	if (!inv || inv.usedAt || inv.revokedAt || inv.expiresAt <= now) return null;
	return inv;
}

/** Who sent this code (shown before the parent connects). Null if it doesn't work. */
export async function previewInvite(db: DB, code: string, now = new Date()) {
	const inv = await inviteByCode(db, code, now);
	if (!inv) return null;
	const [s] = await db
		.select({
			name: user.name,
			level: profile.level,
			isUnder18: profile.isUnder18
		})
		.from(user)
		.leftJoin(profile, eq(profile.userId, user.id))
		.where(eq(user.id, inv.studentId));
	if (!s) return null;
	return {
		firstName: shortName(s.name),
		level: s.level,
		isUnder18: !!s.isUnder18,
		expiresAt: inv.expiresAt
	};
}

async function currentGuardian(db: DB, studentId: string) {
	const [g] = await db
		.select({ parentId: familyLink.parentId })
		.from(familyLink)
		.where(
			and(
				eq(familyLink.studentId, studentId),
				eq(familyLink.guardian, true),
				eq(familyLink.status, 'active')
			)
		)
		.limit(1);
	return g?.parentId ?? null;
}

/**
 * A parent uses a code. Works once. For a child under 18 the first parent who confirms they
 * are the parent or legal guardian becomes the guardian; later parents wait for the
 * guardian's OK when the guardian has asked for that.
 */
export async function redeemInvite(
	db: DB,
	code: string,
	parentId: string,
	opts: { guardianClaim: boolean },
	now = new Date()
) {
	const [p] = await db.select({ role: user.role }).from(user).where(eq(user.id, parentId));
	if (!p || p.role !== 'parent') throw new FamilyFail('fam_err_not_parent');
	return db.transaction(async (tx) => {
		const inv = await inviteByCode(tx, code, now, true);
		if (!inv) throw new FamilyFail('fam_err_code');
		if (inv.studentId === parentId) throw new FamilyFail('fam_err_code');
		const [existing] = await tx
			.select()
			.from(familyLink)
			.where(and(eq(familyLink.parentId, parentId), eq(familyLink.studentId, inv.studentId)));
		if (existing) throw new FamilyFail('fam_err_already');

		const [prof] = await tx
			.select({ isUnder18: profile.isUnder18 })
			.from(profile)
			.where(eq(profile.userId, inv.studentId));
		const minor = !!prof?.isUnder18;
		const guardianId = await currentGuardian(tx, inv.studentId);
		let guardian = false;
		let status: 'active' | 'pending_guardian' = 'active';
		if (minor) {
			if (!guardianId) guardian = opts.guardianClaim;
			else {
				const [perm] = await tx
					.select()
					.from(guardianPermission)
					.where(eq(guardianPermission.studentId, inv.studentId));
				if (perm?.approveNewFamily ?? true) status = 'pending_guardian';
			}
		}
		await tx.insert(familyLink).values({
			parentId,
			studentId: inv.studentId,
			guardian,
			status,
			inviteId: inv.id
		});
		await tx
			.update(familyInvite)
			.set({ usedAt: now, usedBy: parentId })
			.where(eq(familyInvite.id, inv.id));
		return { studentId: inv.studentId, status, guardian, guardianId };
	});
}

/* ---------------------------------------------------------------- who is connected */

/** A parent's children (active links first, then those waiting for the guardian). */
export function childrenOf(db: DB, parentId: string) {
	return db
		.select({
			studentId: familyLink.studentId,
			name: user.name,
			level: profile.level,
			isUnder18: profile.isUnder18,
			managed: profile.managed,
			guardian: familyLink.guardian,
			status: familyLink.status,
			shareProgress: familyLink.shareProgress,
			shareLessons: familyLink.shareLessons,
			shareHomework: familyLink.shareHomework,
			shareStudy: familyLink.shareStudy
		})
		.from(familyLink)
		.innerJoin(user, eq(user.id, familyLink.studentId))
		.leftJoin(profile, eq(profile.userId, familyLink.studentId))
		.where(and(eq(familyLink.parentId, parentId), isNull(user.suspendedAt)))
		.orderBy(asc(familyLink.status), asc(familyLink.createdAt));
}

/** A student's connected parents and guardians. */
export function familyOf(db: DB, studentId: string) {
	return db
		.select({
			parentId: familyLink.parentId,
			name: user.name,
			label: familyLink.label,
			guardian: familyLink.guardian,
			status: familyLink.status,
			shareProgress: familyLink.shareProgress,
			shareLessons: familyLink.shareLessons,
			shareHomework: familyLink.shareHomework,
			shareStudy: familyLink.shareStudy,
			createdAt: familyLink.createdAt
		})
		.from(familyLink)
		.innerJoin(user, eq(user.id, familyLink.parentId))
		.where(eq(familyLink.studentId, studentId))
		.orderBy(asc(familyLink.createdAt));
}

export type ShareKey = 'progress' | 'lessons' | 'homework' | 'study' | 'checkins';

export interface Access {
	/** the link exists and is active */
	ok: boolean;
	guardian: boolean;
	progress: boolean;
	lessons: boolean;
	homework: boolean;
	study: boolean;
}

const NO_ACCESS: Access = {
	ok: false,
	guardian: false,
	progress: false,
	lessons: false,
	homework: false,
	study: false
};

/**
 * What one parent may see of one child. Every parent page calls this; a parent who is not
 * actively connected sees nothing at all. For a child under 18 the guardian always sees
 * lessons, homework, study and progress (they manage the child's permissions).
 * Check-ins are separate: only the ones the child chose to share, never their notes.
 */
export async function parentAccess(db: DB, parentId: string, studentId: string): Promise<Access> {
	const [row] = await db
		.select({ link: familyLink, isUnder18: profile.isUnder18, suspended: user.suspendedAt })
		.from(familyLink)
		.innerJoin(user, eq(user.id, familyLink.studentId))
		.leftJoin(profile, eq(profile.userId, familyLink.studentId))
		.where(and(eq(familyLink.parentId, parentId), eq(familyLink.studentId, studentId)));
	if (!row || row.link.status !== 'active' || row.suspended) return NO_ACCESS;
	const l = row.link;
	const managedByGuardian = l.guardian && !!row.isUnder18;
	return {
		ok: true,
		guardian: l.guardian,
		progress: managedByGuardian || l.shareProgress,
		lessons: managedByGuardian || l.shareLessons,
		homework: managedByGuardian || l.shareHomework,
		study: managedByGuardian || l.shareStudy
	};
}

/** Parent ids that should hear about this child's `what` (respecting what the child shares). */
export async function parentsWhoSee(
	db: DB,
	studentId: string,
	what: Exclude<ShareKey, 'checkins'>
) {
	const rows = await db
		.select({ parentId: familyLink.parentId })
		.from(familyLink)
		.where(and(eq(familyLink.studentId, studentId), eq(familyLink.status, 'active')));
	const out: string[] = [];
	for (const r of rows) {
		const a = await parentAccess(db, r.parentId, studentId);
		if (a.ok && a[what]) out.push(r.parentId);
	}
	return out;
}

/** Parent ids actively connected to this child (for shared check-ins). */
export async function activeParents(db: DB, studentId: string) {
	const rows = await db
		.select({ parentId: familyLink.parentId })
		.from(familyLink)
		.where(and(eq(familyLink.studentId, studentId), eq(familyLink.status, 'active')));
	return rows.map((r) => r.parentId);
}

/**
 * The student changes what one parent sees. A child under 18 cannot hide the basics from
 * their guardian (the guardian manages permissions); check-ins are always chosen one by one.
 */
export async function setSharing(
	db: DB,
	studentId: string,
	parentId: string,
	v: {
		progress: boolean;
		lessons: boolean;
		homework: boolean;
		study: boolean;
		label?: string | null;
	}
) {
	const [row] = await db
		.select({ guardian: familyLink.guardian, isUnder18: profile.isUnder18 })
		.from(familyLink)
		.leftJoin(profile, eq(profile.userId, familyLink.studentId))
		.where(and(eq(familyLink.studentId, studentId), eq(familyLink.parentId, parentId)));
	if (!row) throw new FamilyFail('err_not_found');
	const locked = row.guardian && !!row.isUnder18;
	await db
		.update(familyLink)
		.set({
			shareProgress: locked || v.progress,
			shareLessons: locked || v.lessons,
			shareHomework: locked || v.homework,
			shareStudy: locked || v.study,
			...(v.label !== undefined ? { label: v.label } : {})
		})
		.where(and(eq(familyLink.studentId, studentId), eq(familyLink.parentId, parentId)));
}

/**
 * Ends a connection. The student can remove anyone except, while under 18, their guardian;
 * a parent can always leave.
 */
export async function removeLink(
	db: DB,
	by: { role: 'student' | 'parent'; id: string },
	studentId: string,
	parentId: string
) {
	if (by.role === 'student' && by.id !== studentId) throw new FamilyFail('err_not_found');
	if (by.role === 'parent' && by.id !== parentId) throw new FamilyFail('err_not_found');
	const [row] = await db
		.select({ guardian: familyLink.guardian, isUnder18: profile.isUnder18 })
		.from(familyLink)
		.leftJoin(profile, eq(profile.userId, familyLink.studentId))
		.where(and(eq(familyLink.studentId, studentId), eq(familyLink.parentId, parentId)));
	if (!row) throw new FamilyFail('err_not_found');
	if (by.role === 'student' && row.guardian && row.isUnder18)
		throw new FamilyFail('fam_err_guardian_stays');
	// a School+ partnership this parent started ends with the connection
	await db
		.update(partnership)
		.set({ status: 'stopped', stoppedAt: new Date(), schoolTokenHash: null })
		.where(
			and(
				eq(partnership.parentId, parentId),
				eq(partnership.studentId, studentId),
				inArray(partnership.status, ['requested', 'school_invited', 'active'])
			)
		);
	await db
		.delete(familyLink)
		.where(and(eq(familyLink.studentId, studentId), eq(familyLink.parentId, parentId)));
}

/** The guardian lets another parent in (or says no). */
export async function decidePending(
	db: DB,
	guardianId: string,
	studentId: string,
	parentId: string,
	allow: boolean
) {
	const a = await parentAccess(db, guardianId, studentId);
	if (!a.ok || !a.guardian) throw new FamilyFail('err_not_found');
	const where = and(
		eq(familyLink.studentId, studentId),
		eq(familyLink.parentId, parentId),
		eq(familyLink.status, 'pending_guardian')
	);
	if (allow) await db.update(familyLink).set({ status: 'active' }).where(where);
	else await db.delete(familyLink).where(where);
}

export async function guardianPermissions(db: DB, studentId: string) {
	const [p] = await db
		.select()
		.from(guardianPermission)
		.where(eq(guardianPermission.studentId, studentId));
	return p ?? { studentId, toolsAllowed: false, approveNewFamily: true };
}

export async function setGuardianPermissions(
	db: DB,
	guardianId: string,
	studentId: string,
	v: { toolsAllowed: boolean; approveNewFamily: boolean }
) {
	const a = await parentAccess(db, guardianId, studentId);
	if (!a.ok || !a.guardian) throw new FamilyFail('err_not_found');
	await db
		.insert(guardianPermission)
		.values({ studentId, ...v, updatedBy: guardianId })
		.onConflictDoUpdate({
			target: guardianPermission.studentId,
			set: { ...v, updatedBy: guardianId, updatedAt: new Date() }
		});
}

/** May this student connect outside tools? Adults yes; under 18 only if the guardian allows. */
export async function toolsAllowedFor(db: DB, studentId: string) {
	const [p] = await db
		.select({ isUnder18: profile.isUnder18 })
		.from(profile)
		.where(eq(profile.userId, studentId));
	if (!p?.isUnder18) return true;
	const g = await currentGuardian(db, studentId);
	if (!g) return true; // no guardian connected yet: the parent contact given at sign-up applies
	return (await guardianPermissions(db, studentId)).toolsAllowed;
}

/* ---------------------------------------------------------------- younger children's accounts */

export const KID_DOMAIN = 'kids.tutora.invalid';
export const usernameRe = /^[a-z0-9][a-z0-9._-]{2,29}$/;

/** "tino.dube" → the internal login address of a younger child's account. */
export function usernameEmail(username: string) {
	return `${username.trim().toLowerCase()}@${KID_DOMAIN}`;
}

/** The login a person typed: an email, or a younger child's username. */
export function loginEmail(typed: string): string {
	const t = typed.trim().toLowerCase();
	if (t.includes('@')) return t;
	return usernameRe.test(t) ? usernameEmail(t) : t;
}

export function isKidEmail(email: string) {
	return email.endsWith(`@${KID_DOMAIN}`);
}

/** The username part of a younger child's login, or null when they have no login yet. */
export function kidUsername(email: string): string | null {
	if (!isKidEmail(email) || email.startsWith('child-')) return null;
	return email.slice(0, -KID_DOMAIN.length - 1);
}

export async function countPending(db: DB, guardianId: string) {
	const [r] = await db
		.execute<{ n: number }>(
			sql`
		select count(*)::int as n from family_link f
		join family_link g on g.student_id = f.student_id and g.parent_id = ${guardianId}
		  and g.guardian and g.status = 'active'
		where f.status = 'pending_guardian'`
		)
		.then(
			(x) => (x as unknown as { rows?: { n: number }[] }).rows ?? (x as unknown as { n: number }[])
		);
	return r?.n ?? 0;
}
