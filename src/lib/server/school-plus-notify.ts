/**
 * School+: who hears about each step. The guardian, the tutor and (once they have an
 * account) the schoolteacher, each with a link to their own page. In the app (bell) always,
 * by email where the person allows it.
 */
import type { DB } from './db/types.ts';
import { notifyUser } from './notify.ts';
import { sendEmail, emailEnabled } from './auth.ts';
import type { Partnership } from './partnership.ts';
import { m } from '../paraglide/messages.js';

export type SchoolPlusEvent =
	| 'requested'
	| 'tutor_accepted'
	| 'tutor_declined'
	| 'teacher_invited'
	| 'teacher_accepted'
	| 'teacher_declined'
	| 'active'
	| 'withdrawn'
	| 'ended'
	| 'message'
	| 'plan'
	| 'report';

const link = {
	parent: (p: Partnership) => `/parent/school-plus?child=${encodeURIComponent(p.studentId)}`,
	tutor: () => '/tutor/school-plus',
	teacher: (p: Partnership) => `/teacher/p/${p.id}`
};

/**
 * Tell everyone who should know, except the person who did it (`by`).
 * `by` is a user id, or 'teacher' for a teacher without an account yet.
 */
export async function tellSchoolPlus(
	db: DB,
	p: Partnership,
	event: SchoolPlusEvent,
	by: string | null
) {
	const subject = p.subject;
	const s = m[`spn_${event}_s` as 'spn_requested_s']({ subject });
	const b = m[`spn_${event}_b` as 'spn_requested_b']({ subject, school: p.schoolName });
	const to: { id: string; href: string }[] = [];
	const parent = { id: p.parentId, href: link.parent(p) };
	const tutor = { id: p.tutorId, href: link.tutor() };
	const teacher = p.teacherId ? { id: p.teacherId, href: link.teacher(p) } : null;
	switch (event) {
		case 'requested':
			to.push(tutor);
			break;
		case 'tutor_accepted':
		case 'tutor_declined':
		case 'teacher_invited':
			to.push(parent);
			break;
		case 'teacher_accepted':
		case 'teacher_declined':
			to.push(parent, tutor);
			break;
		default:
			to.push(parent, tutor);
			if (teacher) to.push(teacher);
	}
	for (const r of to)
		if (r.id !== by) await notifyUser(db, r.id, s, b, { kind: 'family', link: r.href });
}

/** The invite link by email to the teacher, when the parent gave an address and email works. */
export async function emailInvite(p: Partnership, url: string, tutorName: string) {
	if (!p.teacherEmail || !emailEnabled) return false;
	try {
		await sendEmail({
			to: p.teacherEmail,
			subject: m.spn_invite_email_s({ tutor: tutorName }),
			text: m.spn_invite_email_b({
				tutor: tutorName,
				school: p.schoolName,
				subject: p.subject,
				url
			})
		});
		return true;
	} catch {
		return false;
	}
}
