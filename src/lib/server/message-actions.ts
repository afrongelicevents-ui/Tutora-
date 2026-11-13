/** Shared page logic for student / tutor conversation pages. */
import { error, fail } from '@sveltejs/kit';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { user } from './db/auth.schema.ts';
import { notification, tutorProfile } from './db/app.schema.ts';
import { readingParents, sendMessage, thread } from './messages.ts';
import { hitLimit } from './rate-limit.ts';
import { notifyUser } from './notify.ts';
import { m } from '../paraglide/messages.js';

export async function namesOf(db: DB, ids: string[]) {
	const [us, tps] = await Promise.all([
		db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, ids)),
		db
			.select({ id: tutorProfile.tutorId, name: tutorProfile.tutorName })
			.from(tutorProfile)
			.where(inArray(tutorProfile.tutorId, ids))
	]);
	const out: Record<string, string> = {};
	for (const u of us) out[u.id] = u.name;
	for (const t of tps) if (t.name) out[t.id] = t.name;
	return out;
}

export async function loadThread(
	db: DB,
	viewer: { id: string; role: string },
	pair: { tutorId: string; studentId: string }
) {
	const messages = await thread(db, viewer, pair);
	if (!messages) error(404, 'Not found');
	// reading the conversation clears its "new message" notifications from the bell
	const own =
		viewer.id === pair.studentId
			? `/student/messages/${pair.tutorId}`
			: viewer.id === pair.tutorId
				? `/tutor/messages/${pair.studentId}`
				: null;
	if (own)
		await db
			.update(notification)
			.set({ readAt: new Date() })
			.where(
				and(
					eq(notification.userId, viewer.id),
					eq(notification.link, own),
					isNull(notification.readAt)
				)
			);
	const [names, parents] = await Promise.all([
		namesOf(db, [pair.tutorId, pair.studentId]),
		readingParents(db, pair.studentId)
	]);
	return { messages, names, parentsCanRead: parents.length > 0 };
}

export async function sendAction(
	db: DB,
	me: { id: string },
	pair: { tutorId: string; studentId: string },
	form: FormData,
	link: (toId: string) => string
) {
	if (!(await hitLimit(db, 'message', me.id)).ok) return fail(429, { error: 'msg_err_limit' });
	const r = await sendMessage(db, me.id, pair, String(form.get('body') ?? ''));
	if (!r.ok) return fail(400, { error: r.error });
	const names = await namesOf(db, [me.id]);
	const name = names[me.id] ?? '';
	await notifyUser(db, r.toId, m.msg_new_s({ name }), m.msg_new_b({ name }), {
		kind: 'message',
		link: link(r.toId)
	});
	return { sent: true };
}

export const isId = (v: string) => /^[A-Za-z0-9_-]{1,64}$/.test(v);
