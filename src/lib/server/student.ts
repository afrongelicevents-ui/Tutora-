import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import {
	attendee,
	booking,
	charge,
	child,
	enrollment,
	favourite,
	homework,
	homeworkAnswer,
	lesson,
	notification,
	payment,
	paymentAllocation,
	profile,
	review,
	subject,
	tutorProfile
} from './db/app.schema.ts';
import { account, session, twoFactor, user } from './db/auth.schema.ts';
import { balances } from './billing.ts';
import { addDays, localDate } from '../tz.ts';

/* ---------- a parent's children ---------- */

export const myChildren = (db: DB, parentId: string) =>
	db.select().from(child).where(eq(child.parentId, parentId)).orderBy(asc(child.id));

export async function addChild(
	db: DB,
	parentId: string,
	v: { name: string; level: string | null; schoolYear: string | null }
) {
	const [row] = await db
		.insert(child)
		.values({ parentId, ...v })
		.returning();
	return row;
}

/** Removes a child (past lessons keep their records). */
export async function removeChild(db: DB, parentId: string, id: number) {
	await db.delete(child).where(and(eq(child.id, id), eq(child.parentId, parentId)));
}

/* ---------- "Needs your attention" ---------- */

export interface AttentionItem {
	kind: 'owe' | 'proposal' | 'declined' | 'homework' | 'payment_declined';
	text: { key: string; values: Record<string, string | number> };
	link: string;
}

export async function attentionFor(db: DB, userId: string, now = new Date()) {
	const items: AttentionItem[] = [];
	const tutors = await db
		.select({
			tutorId: enrollment.tutorId,
			slug: tutorProfile.slug,
			name: tutorProfile.tutorName,
			currency: tutorProfile.currency
		})
		.from(enrollment)
		.innerJoin(tutorProfile, eq(tutorProfile.tutorId, enrollment.tutorId))
		.where(eq(enrollment.userId, userId));
	for (const t of tutors) {
		const b = (await balances(db, t.tutorId, [userId])).get(userId);
		if (b && b.owed - b.waiting > 0)
			items.push({
				kind: 'owe',
				text: {
					key: 'att_owe',
					values: { amount: b.owed - b.waiting, currency: t.currency, name: t.name ?? '' }
				},
				link: `/student/payments?tutor=${t.slug}`
			});
	}
	const reqs = await db
		.select({ id: booking.id, status: booking.status, name: tutorProfile.tutorName, slug: tutorProfile.slug })
		.from(booking)
		.innerJoin(tutorProfile, eq(tutorProfile.tutorId, booking.tutorId))
		.where(
			and(
				eq(booking.userId, userId),
				inArray(booking.status, ['proposed', 'declined']),
				gte(booking.decidedAt, addDays(now, -14))
			)
		);
	for (const r of reqs)
		items.push(
			r.status === 'proposed'
				? {
						kind: 'proposal',
						text: { key: 'att_proposal', values: { name: r.name ?? '' } },
						link: '/student#requests'
					}
				: {
						kind: 'declined',
						text: { key: 'att_declined', values: { name: r.name ?? '' } },
						link: `/student/book?tutor=${r.slug}`
					}
		);
	const due = await db
		.select({ id: homework.id, title: homework.title, dueOn: homework.dueOn })
		.from(homework)
		.leftJoin(homeworkAnswer, eq(homeworkAnswer.homeworkId, homework.id))
		.where(
			and(
				eq(homework.userId, userId),
				isNull(homeworkAnswer.id),
				lte(homework.dueOn, localDate(addDays(now, 3)))
			)
		);
	for (const h of due)
		items.push({
			kind: 'homework',
			text: { key: 'att_homework', values: { title: h.title, date: h.dueOn ?? '' } },
			link: '/student/homework'
		});
	const declinedPays = await db
		.select({ id: payment.id, slug: tutorProfile.slug })
		.from(payment)
		.innerJoin(tutorProfile, eq(tutorProfile.tutorId, payment.tutorId))
		.where(
			and(
				eq(payment.userId, userId),
				eq(payment.status, 'rejected'),
				gte(payment.decidedAt, addDays(now, -14))
			)
		);
	for (const p of declinedPays)
		items.push({
			kind: 'payment_declined',
			text: { key: 'att_payment_declined', values: {} },
			link: `/student/payments?tutor=${p.slug}&tab=history`
		});
	return items;
}

/* ---------- favourites ---------- */

export const myFavourites = (db: DB, userId: string) =>
	db
		.select({ slug: tutorProfile.slug, name: tutorProfile.tutorName })
		.from(favourite)
		.innerJoin(tutorProfile, eq(tutorProfile.tutorId, favourite.tutorId))
		.where(and(eq(favourite.userId, userId), eq(tutorProfile.status, 'active')))
		.orderBy(desc(favourite.createdAt));

/* ---------- one lesson, for the student who is booked on it ---------- */

export async function myLesson(db: DB, userId: string, lessonId: number) {
	const [row] = await db
		.select({
			id: lesson.id,
			kind: lesson.kind,
			mode: lesson.mode,
			startsAt: lesson.startsAt,
			endsAt: lesson.endsAt,
			status: lesson.status,
			capacity: lesson.capacity,
			subjectName: subject.name,
			tutorName: tutorProfile.tutorName,
			tutorSlug: tutorProfile.slug,
			town: tutorProfile.town,
			cancelHours: tutorProfile.cancelHours,
			whatsapp: tutorProfile.whatsappNumber,
			currency: tutorProfile.currency,
			attendeeId: attendee.id,
			attendeeStatus: attendee.status,
			attendance: attendee.attendance,
			priceCents: attendee.priceCents,
			packageId: attendee.studentPackageId,
			childName: child.name
		})
		.from(attendee)
		.innerJoin(lesson, eq(lesson.id, attendee.lessonId))
		.innerJoin(tutorProfile, eq(tutorProfile.tutorId, lesson.tutorId))
		.leftJoin(subject, eq(subject.id, lesson.subjectId))
		.leftJoin(child, eq(child.id, attendee.childId))
		.where(and(eq(attendee.lessonId, lessonId), eq(attendee.userId, userId)));
	if (!row) return null;
	let payState: 'free' | 'package' | 'paid' | 'reported' | 'due' = 'due';
	if (row.kind === 'intro' || row.priceCents === 0) payState = 'free';
	else if (row.packageId) payState = 'package';
	else {
		const [c] = await db
			.select({
				amount: charge.amountCents,
				paid: sql<number>`coalesce(sum(${paymentAllocation.amountCents}), 0)::int`
			})
			.from(charge)
			.leftJoin(paymentAllocation, eq(paymentAllocation.chargeId, charge.id))
			.where(and(eq(charge.attendeeId, row.attendeeId), eq(charge.voided, false)))
			.groupBy(charge.id);
		if (c && c.paid >= c.amount) payState = 'paid';
		else {
			const [pending] = await db
				.select({ id: payment.id })
				.from(payment)
				.innerJoin(tutorProfile, eq(tutorProfile.tutorId, payment.tutorId))
				.where(
					and(
						eq(payment.userId, userId),
						eq(payment.status, 'pending'),
						eq(tutorProfile.slug, row.tutorSlug)
					)
				)
				.limit(1);
			payState = pending ? 'reported' : 'due';
		}
	}
	return { ...row, payState };
}

/* ---------- my data and deleting my account ---------- */

/** Everything Tutora holds about this person, as one JSON file (data download). */
export async function exportMyData(db: DB, userId: string) {
	const [u] = await db
		.select({ id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt })
		.from(user)
		.where(eq(user.id, userId));
	const [prof, kids, bookings, places, payments, hw, reviews, notes] = await Promise.all([
		db.select().from(profile).where(eq(profile.userId, userId)),
		db.select().from(child).where(eq(child.parentId, userId)),
		db.select().from(booking).where(eq(booking.userId, userId)),
		db
			.select({ lesson: lesson, place: attendee })
			.from(attendee)
			.innerJoin(lesson, eq(lesson.id, attendee.lessonId))
			.where(eq(attendee.userId, userId)),
		db.select().from(payment).where(eq(payment.userId, userId)),
		db.select().from(homework).where(eq(homework.userId, userId)),
		db.select().from(review).where(eq(review.userId, userId)),
		db.select().from(notification).where(eq(notification.userId, userId))
	]);
	// the tutor's private notes about the student are the tutor's working notes: left out
	const lessons = places.map((p) => ({
		...p.lesson,
		place: { ...p.place, privateNote: undefined }
	}));
	return {
		exportedAt: new Date().toISOString(),
		account: u,
		profile: prof[0] ?? null,
		children: kids,
		bookings,
		lessons,
		payments,
		homework: hw,
		reviews,
		notifications: notes
	};
}

/**
 * Deletes the account: personal details, login, children, favourites and notifications are
 * removed. Lessons, payments and receipts stay for the tutor's records, linked to a nameless
 * "Deleted user" (money records are never deleted).
 */
export async function deleteMyAccount(db: DB, userId: string) {
	await db.transaction(async (tx) => {
		await tx.delete(session).where(eq(session.userId, userId));
		await tx.delete(account).where(eq(account.userId, userId));
		await tx.delete(twoFactor).where(eq(twoFactor.userId, userId));
		await tx.delete(child).where(eq(child.parentId, userId));
		await tx.delete(favourite).where(eq(favourite.userId, userId));
		await tx.delete(notification).where(eq(notification.userId, userId));
		await tx.delete(review).where(eq(review.userId, userId));
		await tx
			.update(profile)
			.set({ phone: null, parentName: null, parentPhone: null, parentEmail: null, childName: null })
			.where(eq(profile.userId, userId));
		await tx
			.update(user)
			.set({
				name: 'Deleted user',
				email: `deleted-${userId}@deleted.invalid`,
				emailVerified: false,
				image: null,
				suspendedAt: new Date()
			})
			.where(eq(user.id, userId));
		// a tutor's public page goes offline
		await tx
			.update(tutorProfile)
			.set({ status: 'suspended', whatsappNumber: null, phone: null, contactEmail: null, photoKey: null })
			.where(eq(tutorProfile.tutorId, userId));
	});
}
