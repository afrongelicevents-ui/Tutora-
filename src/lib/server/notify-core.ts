import { eq } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { user } from './db/auth.schema.ts';
import { notification, notificationPref } from './db/app.schema.ts';

export type NotifyKind =
	'booking' | 'lesson' | 'payment' | 'homework' | 'review' | 'account' | 'reminder';

export interface NotifyOpts {
	kind?: NotifyKind;
	/** where the in-app notification leads */
	link?: string;
}

/** Reminders and homework messages can be switched off; bookings, payments and account can't. */
const optional = (kind: NotifyKind) => kind === 'reminder' || kind === 'homework';

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
		.select({ email: user.email, name: user.name })
		.from(user)
		.where(eq(user.id, userId));
	if (!u) return null;
	const [pref] = await db
		.select()
		.from(notificationPref)
		.where(eq(notificationPref.userId, userId));
	if (pref && kind === 'reminder' && pref.remindersOff) return null;
	if (pref && kind === 'homework' && pref.homeworkOff) return null;
	await db
		.insert(notification)
		.values({ userId, kind, title: subject, body, link: opts.link ?? null });
	return { ...u, sendEmail: !(pref?.emailOff && optional(kind)) };
}

export type Notify = (
	userId: string,
	subject: string,
	body: string,
	opts?: NotifyOpts
) => Promise<void>;
