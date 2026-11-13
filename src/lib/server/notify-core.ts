import { eq } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { user } from './db/auth.schema.ts';
import { notification, notificationPref } from './db/app.schema.ts';

export type NotifyKind =
	| 'booking'
	| 'lesson'
	| 'payment'
	| 'homework'
	| 'review'
	| 'account'
	| 'reminder'
	/** family: study time started / finished */
	| 'study'
	/** family: the weekly report */
	| 'weekly'
	/** family: a child's lesson was booked, confirmed or moved */
	| 'family_lesson'
	/** family: connections, shared check-ins, School+ */
	| 'family'
	/** a message from a tutor or student */
	| 'message';

export interface NotifyOpts {
	kind?: NotifyKind;
	/** where the in-app notification leads */
	link?: string;
}

/** Reminders and homework messages can be switched off; bookings, payments and account can't. */
const optional = (kind: NotifyKind) =>
	kind === 'reminder' ||
	kind === 'homework' ||
	kind === 'study' ||
	kind === 'weekly' ||
	kind === 'family_lesson';

/**
 * Saves the in-app notification (respecting the person's settings) and says whether an email
 * should also go out. No email sending here, so scripts and tests can use it.
 */
export async function saveNotification(
	db: DB,
	userId: string,
	subject: string,
	body: string,
	opts: NotifyOpts = {}
): Promise<{ email: string; name: string; sendEmail: boolean } | null> {
	const kind = opts.kind ?? 'booking';
	const [u] = await db
		.select({ email: user.email, name: user.name, role: user.role })
		.from(user)
		.where(eq(user.id, userId));
	if (!u) return null;
	const [pref] = await db
		.select()
		.from(notificationPref)
		.where(eq(notificationPref.userId, userId));
	if (pref && kind === 'reminder' && pref.remindersOff) return null;
	if (pref && kind === 'homework' && pref.homeworkOff) return null;
	if (pref && kind === 'study' && pref.studyOff) return null;
	if (pref && kind === 'weekly' && pref.weeklyOff) return null;
	if (pref && kind === 'family_lesson' && pref.lessonsOff) return null;
	await db.insert(notification).values({
		userId,
		kind,
		title: subject,
		body,
		link: u.role === 'parent' ? parentSafeLink(opts.link ?? null) : (opts.link ?? null)
	});
	// placeholder addresses (younger children's accounts) never get email
	const deliverable = !u.email.endsWith('.invalid');
	return {
		email: u.email,
		name: u.name,
		sendEmail: deliverable && !(pref?.emailOff && optional(kind))
	};
}

export type Notify = (
	userId: string,
	subject: string,
	body: string,
	opts?: NotifyOpts
) => Promise<void>;

/**
 * A parent never lands on a student page (it would only send them back home): a student link
 * in a notice to a parent (e.g. a booking or payment the parent made) becomes the parent page.
 */
export function parentSafeLink(link: string | null) {
	if (!link || !link.startsWith('/student')) return link;
	if (link.startsWith('/student/payments'))
		return link.replace('/student/payments', '/parent/payments');
	if (link.startsWith('/student/buddies')) return '/parent/buddies';
	return '/parent';
}
