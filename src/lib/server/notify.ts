import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { user } from './db/auth.schema.ts';
import { notification, notificationPref } from './db/app.schema.ts';
import { saveNotification, type NotifyOpts } from './notify-core.ts';
export type { NotifyKind, NotifyOpts } from './notify-core.ts';
import { sendEmail } from './auth.ts';
import { m } from '../paraglide/messages.js';

/**
 * Tell someone something: always in the app (bell), and by email when an email service is
 * on and they have not switched that kind off. Never fails the action that called it.
 */
export async function notifyUser(
	db: DB,
	userId: string,
	subject: string,
	body: string,
	opts: NotifyOpts = {}
) {
	try {
		const r = await saveNotification(db, userId, subject, body, opts);
		if (!r?.sendEmail) return;
		await sendEmail({
			to: r.email,
			subject,
			text: `${m.email_hello({ name: r.name })}\n\n${body}\n\n${m.email_sign()}`
		});
	} catch (e) {
		console.error('notifyUser failed', e);
	}
}

/** Tell a tutor. */
export async function notifyTutor(
	db: DB,
	tutorId: string,
	subject: string,
	body: string,
	opts: NotifyOpts = {}
) {
	const [t] = await db
		.select({ id: user.id })
		.from(user)
		.where(and(eq(user.id, tutorId), eq(user.role, 'tutor')));
	if (t) await notifyUser(db, t.id, subject, body, { link: '/tutor', ...opts });
}

/** Tell the platform owner(s), e.g. a tutor submitted their profile. */
export async function notifyOwners(db: DB, subject: string, body: string, link = '/owner') {
	const owners = await db.select({ id: user.id }).from(user).where(eq(user.role, 'owner'));
	for (const o of owners) await notifyUser(db, o.id, subject, body, { kind: 'account', link });
}

/* ---------- the bell ---------- */

export const myNotifications = (db: DB, userId: string, limit = 50) =>
	db
		.select()
		.from(notification)
		.where(eq(notification.userId, userId))
		.orderBy(desc(notification.createdAt), desc(notification.id))
		.limit(limit);

export async function unreadCount(db: DB, userId: string) {
	const [r] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(notification)
		.where(and(eq(notification.userId, userId), isNull(notification.readAt)));
	return r.n;
}

export async function markRead(db: DB, userId: string, ids?: number[]) {
	await db
		.update(notification)
		.set({ readAt: new Date() })
		.where(
			and(eq(notification.userId, userId), ids?.length ? inArray(notification.id, ids) : undefined)
		);
}

export async function getPrefs(db: DB, userId: string) {
	const [p] = await db.select().from(notificationPref).where(eq(notificationPref.userId, userId));
	return p ?? { userId, emailOff: false, remindersOff: false, homeworkOff: false };
}

export async function setPrefs(
	db: DB,
	userId: string,
	v: { emailOff: boolean; remindersOff: boolean; homeworkOff: boolean }
) {
	await db
		.insert(notificationPref)
		.values({ userId, ...v })
		.onConflictDoUpdate({ target: notificationPref.userId, set: v });
}
