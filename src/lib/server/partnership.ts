/**
 * School+ (premium Academic Partnership): with a guardian's written consent, the child's
 * tutor and schoolteacher work together. No payment is taken yet.
 *
 *   requested        a guardian asks (the child must already have a tutor on Tutora)
 *   tutor_accepted   the tutor agrees            (or: declined)
 *   teacher_invited  the tutor sends the teacher a private invite link
 *   teacher_accepted the teacher made a small schoolteacher account and agreed (or: declined)
 *   active           the guardian gave written consent naming that teacher
 *   withdrawn        the guardian stopped it before it was active
 *   ended            anyone stopped it once it was active (or the tutor after agreeing)
 *
 * Every step and every message is logged; the guardian reads the log. A schoolteacher only
 * ever sees the partnerships they accepted.
 */
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { DB } from './db/types.ts';
import {
	partnership,
	partnershipLog,
	partnershipPlan,
	partnershipReport,
	type PartnershipStatus
} from './db/v3.schema.ts';
import { enrollment, profile, tutorProfile } from './db/app.schema.ts';
import { user } from './db/auth.schema.ts';
import { FamilyFail, parentAccess, sha256Hex } from './family.ts';
import { localDate } from '../tz.ts';

const teacherUser = alias(user, 'teacher_user');

export class PartnershipFail extends Error {
	constructor(public code: string) {
		super(code);
	}
}

export type Partnership = typeof partnership.$inferSelect;

/** Still going (not declined, withdrawn or ended). */
export const OPEN: PartnershipStatus[] = [
	'requested',
	'tutor_accepted',
	'teacher_invited',
	'teacher_accepted',
	'active'
];
const DONE: PartnershipStatus[] = ['declined', 'withdrawn', 'ended'];

/** The consent wording the guardian signs (stored exactly as shown). */
export const CONSENT_VERSION = 'v2';
export function consentText(v: {
	child: string;
	tutor: string;
	school: string;
	teacher: string;
	subject: string;
}) {
	return (
		`I give my consent for ${v.tutor} (Tutora tutor) and ${v.teacher} at ${v.school} to talk about ` +
		`${v.child}'s learning in ${v.subject}: topics, exams and progress, and to share a learning ` +
		`plan and short monthly notes with me. I understand that every message is logged, that I can ` +
		`read the log, and that I can stop this at any time. (${CONSENT_VERSION})`
	);
}

const clean = (v: string | null | undefined, max: number) => (v ?? '').trim().slice(0, max);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function log(
	db: DB,
	partnershipId: number,
	kind: 'message' | 'event',
	fromRole: 'parent' | 'tutor' | 'teacher' | 'system',
	fromName: string,
	body: string
) {
	await db.insert(partnershipLog).values({ partnershipId, kind, fromRole, fromName, body });
}

const nameOf = async (db: DB, id: string | null) => {
	if (!id) return '';
	const [u] = await db.select({ name: user.name }).from(user).where(eq(user.id, id));
	return u?.name ?? '';
};
const tutorNameOf = async (db: DB, tutorId: string) => {
	const [t] = await db
		.select({ name: tutorProfile.tutorName })
		.from(tutorProfile)
		.where(eq(tutorProfile.tutorId, tutorId));
	return t?.name ?? '';
};
async function setStatus(db: DB, id: number, from: PartnershipStatus[], set: Partial<Partnership>) {
	// only from the expected status: two clicks (or two people) can't both move it
	const r = await db
		.update(partnership)
		.set(set)
		.where(and(eq(partnership.id, id), inArray(partnership.status, from)))
		.returning();
	if (!r.length) throw new PartnershipFail('sp3_err_changed');
	return r[0];
}

/* ------------------------------------------------------------------ the parent */

/** The tutors a child has on Tutora (School+ needs one), active ones only. */
export async function childTutors(db: DB, studentId: string) {
	return db
		.select({ id: tutorProfile.tutorId, name: tutorProfile.tutorName })
		.from(enrollment)
		.innerJoin(tutorProfile, eq(tutorProfile.tutorId, enrollment.tutorId))
		.where(and(eq(enrollment.userId, studentId), eq(tutorProfile.status, 'active')));
}

/**
 * Can this parent ask for School+ for this child? `reason` explains a no:
 * no_tutor (find a tutor first), adult (18+ decide themselves), not_guardian, open (one is
 * already going for this child).
 */
export async function canRequest(db: DB, parentId: string, studentId: string) {
	const access = await parentAccess(db, parentId, studentId);
	if (!access.ok) return { ok: false as const, reason: 'not_found' as const, tutors: [] };
	const [kid] = await db
		.select({ isUnder18: profile.isUnder18 })
		.from(profile)
		.where(eq(profile.userId, studentId));
	const [tutors, open] = await Promise.all([
		childTutors(db, studentId),
		db
			.select({ id: partnership.id })
			.from(partnership)
			.where(and(eq(partnership.studentId, studentId), inArray(partnership.status, OPEN)))
	]);
	const reason = !kid?.isUnder18
		? ('adult' as const)
		: !access.guardian
			? ('not_guardian' as const)
			: !tutors.length
				? ('no_tutor' as const)
				: open.length
					? ('open' as const)
					: null;
	return reason
		? { ok: false as const, reason, tutors }
		: { ok: true as const, reason: null, tutors };
}

const REASON_CODE = {
	not_found: 'err_not_found',
	adult: 'sp3_err_adult',
	not_guardian: 'sp3_err_guardian',
	no_tutor: 'sp3_err_no_tutor',
	open: 'sp3_err_open'
} as const;

export async function requestPartnership(
	db: DB,
	parentId: string,
	v: {
		studentId: string;
		tutorId: string;
		subject: string;
		schoolName: string;
		teacherName: string;
		teacherEmail?: string | null;
	}
) {
	const can = await canRequest(db, parentId, v.studentId);
	if (!can.ok) {
		if (can.reason === 'not_found') throw new FamilyFail('err_not_found');
		throw new PartnershipFail(REASON_CODE[can.reason]);
	}
	// only one of the child's own tutors
	if (!can.tutors.some((t) => t.id === v.tutorId)) throw new PartnershipFail('sp3_err_tutor');
	const subject = clean(v.subject, 60);
	const schoolName = clean(v.schoolName, 120);
	const teacherName = clean(v.teacherName, 80);
	if (!subject || !schoolName || !teacherName) throw new PartnershipFail('err_required');
	const email = clean(v.teacherEmail, 254);
	if (email && !EMAIL.test(email)) throw new PartnershipFail('err_email');
	const [row] = await db
		.insert(partnership)
		.values({
			studentId: v.studentId,
			parentId,
			tutorId: v.tutorId,
			subject,
			schoolName,
			teacherName,
			teacherEmail: email || null
		})
		.returning();
	await log(db, row.id, 'event', 'parent', await nameOf(db, parentId), 'Asked for School+.');
	return row;
}

/** The parent's written consent, once the teacher has accepted: School+ starts. */
export async function giveConsent(
	db: DB,
	parentId: string,
	id: number,
	v: { consentName: string; consent: boolean }
) {
	const p = await parentPartnership(db, parentId, id);
	if (!p) throw new PartnershipFail('err_not_found');
	const access = await parentAccess(db, parentId, p.studentId);
	if (!access.ok || !access.guardian) throw new PartnershipFail('sp3_err_guardian');
	if (p.status !== 'teacher_accepted') throw new PartnershipFail('sp3_err_changed');
	const consentName = clean(v.consentName, 80);
	if (!v.consent || consentName.length < 2) throw new PartnershipFail('sp3_err_consent');
	const [child, tutor, teacher] = await Promise.all([
		nameOf(db, p.studentId),
		tutorNameOf(db, p.tutorId),
		nameOf(db, p.teacherId)
	]);
	const now = new Date();
	const row = await setStatus(db, id, ['teacher_accepted'], {
		status: 'active',
		consentText: consentText({
			child,
			tutor,
			school: p.schoolName,
			teacher: teacher || p.teacherName,
			subject: p.subject
		}),
		consentName,
		consentAt: now,
		activeAt: now
	});
	await log(
		db,
		id,
		'event',
		'parent',
		await nameOf(db, parentId),
		`Gave written consent, signed "${consentName}". School+ is active.`
	);
	return row;
}

/** The parent stops it: withdrawn before it was active, ended once active. */
export async function stopPartnership(db: DB, parentId: string, id: number) {
	const p = await parentPartnership(db, parentId, id);
	if (!p || DONE.includes(p.status)) throw new PartnershipFail('err_not_found');
	const status = p.status === 'active' ? 'ended' : 'withdrawn';
	const row = await setStatus(db, id, [p.status], {
		status,
		stoppedAt: new Date(),
		stoppedBy: parentId,
		schoolTokenHash: null
	});
	await log(
		db,
		id,
		'event',
		'parent',
		await nameOf(db, parentId),
		status === 'ended' ? 'The parent ended the partnership.' : 'The parent withdrew the request.'
	);
	return row;
}

/** A partnership this parent asked for, while still connected to the child. */
export async function parentPartnership(db: DB, parentId: string, id: number) {
	const [p] = await db
		.select()
		.from(partnership)
		.where(and(eq(partnership.id, id), eq(partnership.parentId, parentId)));
	if (!p || !(await parentAccess(db, parentId, p.studentId)).ok) return null;
	return p;
}

/* ------------------------------------------------------------------ the tutor */

async function tutorPartnership(db: DB, tutorId: string, id: number) {
	const [p] = await db
		.select()
		.from(partnership)
		.where(and(eq(partnership.id, id), eq(partnership.tutorId, tutorId)));
	return p ?? null;
}

/** The tutor agrees or declines a request. */
export async function tutorDecide(db: DB, tutorId: string, id: number, accept: boolean) {
	const p = await tutorPartnership(db, tutorId, id);
	if (!p || p.status !== 'requested') throw new PartnershipFail('err_not_found');
	const row = await setStatus(
		db,
		id,
		['requested'],
		accept
			? { status: 'tutor_accepted', tutorAcceptedAt: new Date() }
			: { status: 'declined', declinedBy: 'tutor', schoolTokenHash: null }
	);
	await log(
		db,
		id,
		'event',
		'tutor',
		await tutorNameOf(db, tutorId),
		accept ? 'The tutor agreed.' : 'The tutor declined.'
	);
	return row;
}

/** A fresh invite link for the teacher (an older one stops working). Returns the token. */
export async function inviteTeacher(db: DB, tutorId: string, id: number) {
	const p = await tutorPartnership(db, tutorId, id);
	if (!p || !['tutor_accepted', 'teacher_invited'].includes(p.status))
		throw new PartnershipFail('err_not_found');
	const bytes = crypto.getRandomValues(new Uint8Array(24));
	const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
	const row = await setStatus(db, id, ['tutor_accepted', 'teacher_invited'], {
		status: 'teacher_invited',
		teacherInvitedAt: new Date(),
		schoolTokenHash: await sha256Hex(token)
	});
	await log(
		db,
		id,
		'event',
		'tutor',
		await tutorNameOf(db, tutorId),
		p.status === 'teacher_invited'
			? 'The tutor sent the teacher a new invite link.'
			: 'The tutor invited the teacher.'
	);
	return { token, p: row };
}

/* ------------------------------------------------------------------ the teacher */

/**
 * The partnership an invite link opens: waiting for the teacher, or (older links) an active
 * one from before teacher accounts, still without a teacher account.
 */
export async function byToken(db: DB, token: string) {
	if (!/^[0-9a-f]{48}$/.test(token)) return null;
	const [p] = await db
		.select()
		.from(partnership)
		.where(eq(partnership.schoolTokenHash, await sha256Hex(token)));
	if (!p) return null;
	if (p.status === 'teacher_invited') return p;
	if (p.status === 'active' && !p.teacherId) return p;
	return null;
}

/** The teacher (signed in with a schoolteacher account) accepts or declines the invite. */
export async function teacherRespond(db: DB, token: string, teacherId: string, accept: boolean) {
	const p = await byToken(db, token);
	if (!p) throw new PartnershipFail('err_not_found');
	const [t] = await db
		.select({ role: user.role, name: user.name })
		.from(user)
		.where(eq(user.id, teacherId));
	if (t?.role !== 'schoolteacher') throw new PartnershipFail('sp3_err_teacher_account');
	const now = new Date();
	let row: Partnership;
	if (p.status === 'active') {
		// an older partnership: the teacher's new account takes over the link
		row = await setStatus(db, p.id, ['active'], { teacherId, schoolTokenHash: null });
	} else if (accept) {
		row = await setStatus(db, p.id, ['teacher_invited'], {
			status: 'teacher_accepted',
			teacherId,
			schoolRespondedAt: now,
			schoolTokenHash: null
		});
	} else {
		row = await setStatus(db, p.id, ['teacher_invited'], {
			status: 'declined',
			declinedBy: 'teacher',
			schoolRespondedAt: now,
			schoolTokenHash: null
		});
	}
	await log(
		db,
		p.id,
		'event',
		'teacher',
		t.name,
		accept || p.status === 'active' ? 'The teacher accepted.' : 'The teacher declined.'
	);
	return row;
}

/** Partnerships a teacher accepted (newest first). */
export async function forTeacher(db: DB, teacherId: string) {
	return db
		.select({ p: partnership, child: user.name, tutor: tutorProfile.tutorName })
		.from(partnership)
		.innerJoin(user, eq(user.id, partnership.studentId))
		.leftJoin(tutorProfile, eq(tutorProfile.tutorId, partnership.tutorId))
		.where(eq(partnership.teacherId, teacherId))
		.orderBy(desc(partnership.createdAt));
}

export async function teacherPartnership(db: DB, teacherId: string, id: number) {
	const [p] = await db
		.select()
		.from(partnership)
		.where(and(eq(partnership.id, id), eq(partnership.teacherId, teacherId)));
	return p ?? null;
}

/* ------------------------------------------------------------------ together */

export type Member =
	| { role: 'tutor'; userId: string }
	| { role: 'teacher'; userId: string }
	| { role: 'parent'; userId: string };

/** The partnership, if this person takes part in it. */
export async function memberPartnership(db: DB, who: Member, id: number) {
	if (who.role === 'tutor') return tutorPartnership(db, who.userId, id);
	if (who.role === 'teacher') return teacherPartnership(db, who.userId, id);
	return parentPartnership(db, who.userId, id);
}

const memberName = (db: DB, who: Member) =>
	who.role === 'tutor' ? tutorNameOf(db, who.userId) : nameOf(db, who.userId);

/** Tutor or teacher stops it (the tutor also after agreeing, before it started). */
export async function endPartnership(db: DB, who: Member, id: number) {
	if (who.role === 'parent') return stopPartnership(db, who.userId, id);
	const p = await memberPartnership(db, who, id);
	const allowed: PartnershipStatus[] =
		who.role === 'tutor'
			? ['tutor_accepted', 'teacher_invited', 'teacher_accepted', 'active']
			: ['teacher_accepted', 'active'];
	if (!p || !allowed.includes(p.status)) throw new PartnershipFail('err_not_found');
	const row = await setStatus(db, id, allowed, {
		status: 'ended',
		stoppedAt: new Date(),
		stoppedBy: who.userId,
		schoolTokenHash: null
	});
	await log(
		db,
		id,
		'event',
		who.role,
		await memberName(db, who),
		who.role === 'tutor' ? 'The tutor ended the partnership.' : 'The teacher ended the partnership.'
	);
	return row;
}

/** A logged message between tutor and teacher (only while active; the parent reads them). */
export async function postMessage(db: DB, who: Member, id: number, body: string) {
	if (who.role === 'parent') throw new PartnershipFail('err_not_found');
	const text = clean(body, 2000);
	if (!text) throw new PartnershipFail('err_required');
	const p = await memberPartnership(db, who, id);
	if (!p || p.status !== 'active') throw new PartnershipFail('err_not_found');
	await log(db, p.id, 'message', who.role, await memberName(db, who), text);
	return p;
}

/** The shared learning plan (tutor or teacher, while active). */
export async function savePlan(
	db: DB,
	who: Member,
	id: number,
	v: { goals?: string; topics?: string; examFocus?: string }
) {
	if (who.role === 'parent') throw new PartnershipFail('err_not_found');
	const p = await memberPartnership(db, who, id);
	if (!p || p.status !== 'active') throw new PartnershipFail('err_not_found');
	const values = {
		goals: clean(v.goals, 1000) || null,
		topics: clean(v.topics, 1000) || null,
		examFocus: clean(v.examFocus, 500) || null,
		updatedByName: await memberName(db, who),
		updatedAt: new Date()
	};
	await db
		.insert(partnershipPlan)
		.values({ partnershipId: id, ...values })
		.onConflictDoUpdate({ target: partnershipPlan.partnershipId, set: values });
	await log(db, id, 'event', who.role, values.updatedByName, 'Updated the shared learning plan.');
	return p;
}

/** This month's short note for the parent (one per person per month; saving again replaces it). */
export async function saveReport(db: DB, who: Member, id: number, body: string, now = new Date()) {
	if (who.role === 'parent') throw new PartnershipFail('err_not_found');
	const text = clean(body, 1500);
	if (!text) throw new PartnershipFail('err_required');
	const p = await memberPartnership(db, who, id);
	if (!p || p.status !== 'active') throw new PartnershipFail('err_not_found');
	const month = localDate(now).slice(0, 7);
	const fromName = await memberName(db, who);
	await db
		.insert(partnershipReport)
		.values({ partnershipId: id, month, fromRole: who.role, fromName, body: text })
		.onConflictDoUpdate({
			target: [
				partnershipReport.partnershipId,
				partnershipReport.month,
				partnershipReport.fromRole
			],
			set: { body: text, fromName, createdAt: new Date() }
		});
	await log(db, id, 'event', who.role, fromName, `Added the ${month} report note.`);
	return p;
}

export const logOf = (db: DB, id: number) =>
	db
		.select()
		.from(partnershipLog)
		.where(eq(partnershipLog.partnershipId, id))
		.orderBy(asc(partnershipLog.createdAt), asc(partnershipLog.id));

/* ------------------------------------------------------------------ views */

export type StepKey =
	'requested' | 'tutor_accepted' | 'teacher_invited' | 'teacher_accepted' | 'consent' | 'active';
export interface Step {
	key: StepKey;
	at: Date | null;
	state: 'done' | 'current' | 'todo';
}

/** The six steps with dates, for a timeline; `stopped` says how a finished one ended. */
export function stepsOf(p: Partnership): {
	steps: Step[];
	stopped: null | {
		status: 'declined' | 'withdrawn' | 'ended';
		by: string | null;
		at: Date | null;
	};
} {
	const at: Record<StepKey, Date | null> = {
		requested: p.createdAt,
		tutor_accepted: p.tutorAcceptedAt,
		teacher_invited: p.teacherInvitedAt,
		teacher_accepted: p.teacherId ? (p.schoolRespondedAt ?? p.activeAt) : null,
		consent: p.consentAt,
		active: p.activeAt
	};
	const order: StepKey[] = [
		'requested',
		'tutor_accepted',
		'teacher_invited',
		'teacher_accepted',
		'consent',
		'active'
	];
	const firstTodo = order.findIndex((k) => !at[k]);
	const finished = DONE.includes(p.status);
	const steps = order.map((key, i) => ({
		key,
		at: at[key],
		state: at[key]
			? ('done' as const)
			: !finished && i === firstTodo
				? ('current' as const)
				: ('todo' as const)
	}));
	return {
		steps,
		stopped: finished
			? {
					status: p.status as 'declined' | 'withdrawn' | 'ended',
					by: p.status === 'declined' ? p.declinedBy : p.stoppedBy,
					at: p.stoppedAt ?? p.schoolRespondedAt
				}
			: null
	};
}

/** Everything a member sees about one partnership (log, plan, report notes). */
export async function details(db: DB, p: Partnership) {
	const [childName, tutorName, teacherName, logRows, planRows, reports] = await Promise.all([
		nameOf(db, p.studentId),
		tutorNameOf(db, p.tutorId),
		nameOf(db, p.teacherId),
		logOf(db, p.id),
		db.select().from(partnershipPlan).where(eq(partnershipPlan.partnershipId, p.id)),
		db
			.select()
			.from(partnershipReport)
			.where(eq(partnershipReport.partnershipId, p.id))
			.orderBy(desc(partnershipReport.month), asc(partnershipReport.fromRole))
	]);
	const { schoolTokenHash: _t, ...rest } = p;
	return {
		p: rest,
		child: childName,
		tutor: tutorName,
		/** the teacher's own account name once they accepted; else the name the parent gave */
		teacher: teacherName || p.teacherName,
		teacherHasAccount: !!p.teacherId,
		since: p.activeAt,
		...stepsOf(p),
		log: logRows,
		plan: planRows[0] ?? null,
		reports,
		messages: logRows.filter((l) => l.kind === 'message').length
	};
}

/** All of a parent's partnerships (newest first), with the child's and tutor's names. */
export async function forParent(db: DB, parentId: string) {
	return db
		.select({ p: partnership, child: user.name, tutor: tutorProfile.tutorName })
		.from(partnership)
		.innerJoin(user, eq(user.id, partnership.studentId))
		.leftJoin(tutorProfile, eq(tutorProfile.tutorId, partnership.tutorId))
		.where(eq(partnership.parentId, parentId))
		.orderBy(desc(partnership.createdAt));
}

/**
 * For the parent's School+ page, per child: can they ask (or why not), the child's tutors,
 * the current partnership (with steps, plan, notes, log) and earlier ones.
 */
export async function schoolPlusForChild(db: DB, parentId: string, studentId: string) {
	const can = await canRequest(db, parentId, studentId);
	if (can.reason === 'not_found') return null;
	const rows = await db
		.select()
		.from(partnership)
		.where(and(eq(partnership.studentId, studentId), eq(partnership.parentId, parentId)))
		.orderBy(desc(partnership.createdAt));
	const open = rows.find((r) => OPEN.includes(r.status)) ?? null;
	return {
		canRequest: can.ok,
		/** why not: no_tutor → show "Find a tutor first" */
		reason: can.reason,
		tutors: can.tutors,
		current: open ? await details(db, open) : null,
		past: rows
			.filter((r) => r !== open)
			.map((r) => ({
				id: r.id,
				status: r.status,
				subject: r.subject,
				school: r.schoolName,
				...stepsOf(r)
			}))
	};
}

/** The tutor's partnerships (newest first), with the teacher's account name once they accepted. */
export async function forTutor(db: DB, tutorId: string) {
	return db
		.select({ p: partnership, child: user.name, teacher: teacherUser.name })
		.from(partnership)
		.innerJoin(user, eq(user.id, partnership.studentId))
		.leftJoin(teacherUser, eq(teacherUser.id, partnership.teacherId))
		.where(eq(partnership.tutorId, tutorId))
		.orderBy(desc(partnership.createdAt));
}
