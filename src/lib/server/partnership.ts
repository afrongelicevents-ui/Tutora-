/**
 * School+ (premium Academic Partnership). With a parent's written consent the child's tutor
 * and schoolteacher work together. Steps: parent requests and consents → tutor agrees and
 * gets a private link for the school → the school opts in (or not) → tutor and teacher
 * exchange messages, all logged. The parent reads the log and can stop it at any time.
 * No payment is taken yet.
 */
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { partnership, partnershipLog } from './db/v3.schema.ts';
import { enrollment, tutorProfile } from './db/app.schema.ts';
import { user } from './db/auth.schema.ts';
import { FamilyFail, parentAccess, sha256Hex } from './family.ts';
import { profile } from './db/app.schema.ts';

export class PartnershipFail extends Error {
	constructor(public code: string) {
		super(code);
	}
}

/** The consent wording the parent signs (stored with the request exactly as shown). */
export const CONSENT_VERSION = 'v1';
export function consentText(v: {
	child: string;
	tutor: string;
	school: string;
	teacher: string;
	subject: string;
}) {
	return (
		`I give my consent for ${v.tutor} (Tutora tutor) and ${v.teacher} at ${v.school} to talk about ` +
		`${v.child}'s learning in ${v.subject}: topics, exams and progress. I understand that every ` +
		`message is logged and that I can read the log, and that I can stop this at any time. ` +
		`The school only takes part if it agrees. (${CONSENT_VERSION})`
	);
}

const clean = (v: string | null | undefined, max: number) => (v ?? '').trim().slice(0, max);

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
		consentName: string;
		consent: boolean;
	}
) {
	const access = await parentAccess(db, parentId, v.studentId);
	if (!access.ok) throw new FamilyFail('err_not_found');
	const [kid] = await db
		.select({ name: user.name, isUnder18: profile.isUnder18 })
		.from(user)
		.leftJoin(profile, eq(profile.userId, user.id))
		.where(eq(user.id, v.studentId));
	// consent for a school child comes from their guardian; an adult student decides for
	// themselves, so School+ is only for children under 18 with a guardian on Tutora
	if (!kid?.isUnder18) throw new PartnershipFail('sp3_err_adult');
	if (!access.guardian) throw new PartnershipFail('sp3_err_guardian');
	const [tutor] = await db
		.select({ name: tutorProfile.tutorName })
		.from(enrollment)
		.innerJoin(tutorProfile, eq(tutorProfile.tutorId, enrollment.tutorId))
		.where(
			and(
				eq(enrollment.tutorId, v.tutorId),
				eq(enrollment.userId, v.studentId),
				eq(tutorProfile.status, 'active')
			)
		);
	if (!tutor) throw new PartnershipFail('sp3_err_tutor');
	const subject = clean(v.subject, 60);
	const schoolName = clean(v.schoolName, 120);
	const teacherName = clean(v.teacherName, 80);
	const consentName = clean(v.consentName, 80);
	if (!subject || !schoolName || !teacherName) throw new PartnershipFail('err_required');
	if (!v.consent || consentName.length < 2) throw new PartnershipFail('sp3_err_consent');
	const email = clean(v.teacherEmail, 254);
	if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new PartnershipFail('err_email');
	const [parent] = await db.select({ name: user.name }).from(user).where(eq(user.id, parentId));
	const text = consentText({
		child: kid?.name ?? '',
		tutor: tutor.name ?? '',
		school: schoolName,
		teacher: teacherName,
		subject
	});
	const [row] = await db
		.insert(partnership)
		.values({
			studentId: v.studentId,
			parentId,
			tutorId: v.tutorId,
			subject,
			schoolName,
			teacherName,
			teacherEmail: email || null,
			consentText: text,
			consentName,
			consentAt: new Date()
		})
		.returning();
	await log(
		db,
		row.id,
		'event',
		'parent',
		parent?.name ?? '',
		`Requested and gave written consent, signed "${consentName}".`
	);
	return row;
}

/** The tutor agrees (and gets the school's private link) or declines. */
export async function tutorDecide(db: DB, tutorId: string, id: number, accept: boolean) {
	const [p] = await db
		.select()
		.from(partnership)
		.where(and(eq(partnership.id, id), eq(partnership.tutorId, tutorId)));
	if (!p || !['requested', 'school_invited'].includes(p.status))
		throw new PartnershipFail('err_not_found');
	const [t] = await db
		.select({ name: tutorProfile.tutorName })
		.from(tutorProfile)
		.where(eq(tutorProfile.tutorId, tutorId));
	if (!accept) {
		await db
			.update(partnership)
			.set({ status: 'declined', schoolTokenHash: null })
			.where(eq(partnership.id, id));
		await log(db, id, 'event', 'tutor', t?.name ?? '', 'The tutor declined the partnership.');
		return { token: null };
	}
	// a fresh private link each time (the old one stops working)
	const bytes = crypto.getRandomValues(new Uint8Array(24));
	const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
	await db
		.update(partnership)
		.set({ status: 'school_invited', schoolTokenHash: await sha256Hex(token) })
		.where(eq(partnership.id, id));
	await log(db, id, 'event', 'tutor', t?.name ?? '', 'The tutor agreed and invited the school.');
	return { token };
}

/** The partnership a school link opens (null when the link no longer works). */
export async function byToken(db: DB, token: string) {
	if (!/^[0-9a-f]{48}$/.test(token)) return null;
	const [p] = await db
		.select()
		.from(partnership)
		.where(eq(partnership.schoolTokenHash, await sha256Hex(token)));
	if (!p || !['school_invited', 'active'].includes(p.status)) return null;
	return p;
}

export async function schoolRespond(db: DB, token: string, accept: boolean, teacherName: string) {
	const p = await byToken(db, token);
	if (!p || p.status !== 'school_invited') throw new PartnershipFail('err_not_found');
	const name = clean(teacherName, 80) || p.teacherName;
	await db
		.update(partnership)
		.set({
			status: accept ? 'active' : 'declined',
			schoolRespondedAt: new Date(),
			...(accept ? {} : { schoolTokenHash: null })
		})
		.where(eq(partnership.id, p.id));
	await log(
		db,
		p.id,
		'event',
		'teacher',
		name,
		accept ? 'The school agreed to take part.' : 'The school decided not to take part.'
	);
}

/** A logged message between tutor and teacher (only while active). */
export async function postMessage(
	db: DB,
	who: { role: 'tutor'; tutorId: string; id: number } | { role: 'teacher'; token: string },
	body: string
) {
	const text = clean(body, 2000);
	if (!text) throw new PartnershipFail('err_required');
	let p;
	let name: string;
	if (who.role === 'tutor') {
		[p] = await db
			.select()
			.from(partnership)
			.where(and(eq(partnership.id, who.id), eq(partnership.tutorId, who.tutorId)));
		const [t] = await db
			.select({ name: tutorProfile.tutorName })
			.from(tutorProfile)
			.where(eq(tutorProfile.tutorId, who.tutorId));
		name = t?.name ?? '';
	} else {
		p = await byToken(db, who.token);
		name = p?.teacherName ?? '';
	}
	if (!p || p.status !== 'active') throw new PartnershipFail('err_not_found');
	await log(db, p.id, 'message', who.role, name, text);
	return p;
}

/** The parent who asked stops it at any time; the school link stops working at once. */
export async function stopPartnership(db: DB, parentId: string, id: number) {
	const [p] = await db
		.select()
		.from(partnership)
		.where(and(eq(partnership.id, id), eq(partnership.parentId, parentId)));
	if (!p || p.status === 'stopped' || p.status === 'declined')
		throw new PartnershipFail('err_not_found');
	const [u] = await db.select({ name: user.name }).from(user).where(eq(user.id, parentId));
	await db
		.update(partnership)
		.set({ status: 'stopped', stoppedAt: new Date(), stoppedBy: parentId, schoolTokenHash: null })
		.where(eq(partnership.id, id));
	await log(db, id, 'event', 'parent', u?.name ?? '', 'The parent stopped the partnership.');
	return p;
}

export const logOf = (db: DB, id: number) =>
	db
		.select()
		.from(partnershipLog)
		.where(eq(partnershipLog.partnershipId, id))
		.orderBy(asc(partnershipLog.createdAt), asc(partnershipLog.id));

export async function forParent(db: DB, parentId: string) {
	return db
		.select({
			p: partnership,
			child: user.name,
			tutor: tutorProfile.tutorName
		})
		.from(partnership)
		.innerJoin(user, eq(user.id, partnership.studentId))
		.leftJoin(tutorProfile, eq(tutorProfile.tutorId, partnership.tutorId))
		.where(eq(partnership.parentId, parentId))
		.orderBy(desc(partnership.createdAt));
}

export async function forTutor(db: DB, tutorId: string) {
	return db
		.select({ p: partnership, child: user.name })
		.from(partnership)
		.innerJoin(user, eq(user.id, partnership.studentId))
		.where(
			and(
				eq(partnership.tutorId, tutorId),
				inArray(partnership.status, [
					'requested',
					'school_invited',
					'active',
					'stopped',
					'declined'
				])
			)
		)
		.orderBy(desc(partnership.createdAt));
}
