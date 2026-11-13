/**
 * "Tell the other side": small helpers so every event reaches the person it affects (and the
 * family who chose to see that kind of thing), in the bell and by email where allowed.
 */
import { and, eq } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { user } from './db/auth.schema.ts';
import {
	attendee,
	homework,
	homeworkAnswer,
	review,
	supportRequest,
	tutorProfile
} from './db/app.schema.ts';
import { activeParents } from './family.ts';
import { familyLink } from './db/v3.schema.ts';
import { notifyUser, type NotifyOpts } from './notify.ts';
import { parentsWhoSee } from './family.ts';
import { firstName } from './study.ts';
import { listStudents } from './people.ts';
import { m } from '../paraglide/messages.js';

type Area = 'lessons' | 'homework' | 'progress' | 'study';

/** Tell a student, and the parents who see this area of their learning. */
export async function tellStudentAndFamily(
	db: DB,
	studentId: string,
	area: Area | null,
	student: { subject: string; body: string; opts: NotifyOpts },
	family?: { subject: string; body: string; opts: NotifyOpts },
	skip: string[] = []
) {
	if (!skip.includes(studentId))
		await notifyUser(db, studentId, student.subject, student.body, student.opts);
	if (!area || !family) return;
	for (const p of await parentsWhoSee(db, studentId, area))
		if (!skip.includes(p)) await notifyUser(db, p, family.subject, family.body, family.opts);
}

export async function nameOf(db: DB, id: string) {
	const [u] = await db.select({ name: user.name }).from(user).where(eq(user.id, id));
	return u?.name ?? '';
}

export async function tutorNameOf(db: DB, tutorId: string) {
	const [t] = await db
		.select({ name: tutorProfile.tutorName })
		.from(tutorProfile)
		.where(eq(tutorProfile.tutorId, tutorId));
	return t?.name ?? (await nameOf(db, tutorId));
}

/** Homework was marked: the student (and parents who see homework) hear about it. */
export async function homeworkMarked(db: DB, tutorId: string, answerId: number) {
	const [h] = await db
		.select({ userId: homework.userId, title: homework.title })
		.from(homeworkAnswer)
		.innerJoin(homework, eq(homework.id, homeworkAnswer.homeworkId))
		.where(eq(homeworkAnswer.id, answerId));
	if (!h) return;
	const tutor = await tutorNameOf(db, tutorId);
	const child = firstName(await nameOf(db, h.userId));
	await tellStudentAndFamily(
		db,
		h.userId,
		'homework',
		{
			subject: m.ev_hw_marked_s({ title: h.title }),
			body: m.ev_hw_marked_b({ tutor, title: h.title }),
			opts: { kind: 'homework', link: '/student/homework' }
		},
		{
			subject: m.ev_hw_marked_fam_s({ name: child }),
			body: m.ev_hw_marked_fam_b({ name: child, title: h.title }),
			opts: { kind: 'homework', link: `/parent/updates?child=${encodeURIComponent(h.userId)}` }
		}
	);
}

/** New homework: the student (and parents who see homework). */
export async function homeworkSet(db: DB, studentId: string, title: string) {
	const child = firstName(await nameOf(db, studentId));
	await tellStudentAndFamily(
		db,
		studentId,
		'homework',
		{
			subject: m.email_hw_new_s(),
			body: m.email_hw_new_b({ title }),
			opts: { kind: 'homework', link: '/student/homework' }
		},
		{
			subject: m.ev_hw_new_fam_s({ name: child }),
			body: m.ev_hw_new_fam_b({ name: child, title }),
			opts: { kind: 'homework', link: `/parent/updates?child=${encodeURIComponent(studentId)}` }
		}
	);
}

/** A review was hidden or shown again by the owner: the tutor is told. */
export async function reviewModerated(db: DB, reviewId: number, hidden: boolean) {
	const [r] = await db
		.select({ tutorId: review.tutorId })
		.from(review)
		.where(eq(review.id, reviewId));
	if (!r) return;
	await notifyUser(
		db,
		r.tutorId,
		hidden ? m.ev_review_hidden_s() : m.ev_review_shown_s(),
		hidden ? m.ev_review_hidden_b() : m.ev_review_shown_b(),
		{ kind: 'review', link: '/tutor/reviews' }
	);
}

/** The tutor replied to a review: the reviewer is told. */
export async function reviewReplied(db: DB, reviewId: number) {
	const [r] = await db
		.select({ userId: review.userId, tutorId: review.tutorId })
		.from(review)
		.where(eq(review.id, reviewId));
	if (!r) return;
	const tutor = await tutorNameOf(db, r.tutorId);
	const [t] = await db
		.select({ slug: tutorProfile.slug })
		.from(tutorProfile)
		.where(eq(tutorProfile.tutorId, r.tutorId));
	await notifyUser(db, r.userId, m.ev_review_reply_s({ tutor }), m.ev_review_reply_b({ tutor }), {
		kind: 'review',
		link: t ? `/t/${t.slug}/reviews` : '/student'
	});
}

/** A support request was dealt with: the person who wrote (if they were signed in) is told. */
export async function supportClosed(db: DB, id: number) {
	const [r] = await db
		.select({ userId: supportRequest.userId })
		.from(supportRequest)
		.where(eq(supportRequest.id, id));
	if (r?.userId)
		await notifyUser(db, r.userId, m.ev_support_done_s(), m.ev_support_done_b(), {
			kind: 'account'
		});
}

/** The student shared their personal report: their family hears about it. */
export async function reportShared(db: DB, studentId: string) {
	const child = firstName(await nameOf(db, studentId));
	for (const p of await activeParents(db, studentId))
		await notifyUser(
			db,
			p,
			m.ev_report_shared_s({ name: child }),
			m.ev_report_shared_b({ name: child }),
			{
				kind: 'family',
				link: `/parent/personal?child=${encodeURIComponent(studentId)}`
			}
		);
}

/** Guardians of a student (the parents who manage payments for them). */
export async function guardiansOf(db: DB, studentId: string) {
	const rows = await db
		.select({ id: familyLink.parentId })
		.from(familyLink)
		.where(
			and(
				eq(familyLink.studentId, studentId),
				eq(familyLink.status, 'active'),
				eq(familyLink.guardian, true)
			)
		);
	return rows.map((r) => r.id);
}

/**
 * Tell the family about something that happened to a student: parents who see `area`
 * (or the guardians for payments). The same words as the student got, with a parent link.
 */
export async function alsoTellFamily(
	db: DB,
	studentId: string,
	area: Area | 'guardians',
	subject: string,
	body: string,
	opts: { kind: NotifyOpts['kind']; link: string },
	skip: string[] = []
) {
	const ids =
		area === 'guardians'
			? await guardiansOf(db, studentId)
			: await parentsWhoSee(db, studentId, area);
	for (const p of ids) if (!skip.includes(p)) await notifyUser(db, p, subject, body, opts);
}

export const parentLink = (path: string, studentId: string) =>
	`${path}${path.includes('?') ? '&' : '?'}child=${encodeURIComponent(studentId)}`;

/** The tutor added a file, link or quiz to a lesson: the booked students are told. */
export async function materialShared(db: DB, tutorId: string, lessonId: number, title: string) {
	const rows = await db
		.select({ id: attendee.userId })
		.from(attendee)
		.where(and(eq(attendee.lessonId, lessonId), eq(attendee.status, 'booked')));
	const tutor = await tutorNameOf(db, tutorId);
	for (const r of rows)
		await notifyUser(db, r.id, m.ev_material_s({ tutor }), m.ev_material_b({ tutor, title }), {
			kind: 'lesson',
			link: `/student/lessons/${lessonId}`
		});
}

/** The tutor added a revision resource: the one student it is for, or all their students. */
export async function resourceShared(
	db: DB,
	tutorId: string,
	studentId: string | null,
	subject: string,
	title: string
) {
	const ids = studentId ? [studentId] : (await listStudents(db, tutorId)).map((s) => s.id);
	const tutor = await tutorNameOf(db, tutorId);
	for (const id of ids)
		await notifyUser(
			db,
			id,
			m.ev_resource_s({ tutor }),
			m.ev_resource_b({ tutor, subject, title }),
			{
				kind: 'homework',
				link: '/student/homework#resources'
			}
		);
}
