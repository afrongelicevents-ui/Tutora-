import type { PageServerLoad } from './$types';
import { requireUser, safeNext } from '#lib/server/guards.ts';
import { BELL_PAGE, markRead, myNotifications } from '#lib/server/notify.ts';

/** My notifications (the bell). Opening the list marks them as read. */
export const load: PageServerLoad = async ({ locals, url }) => {
	const u = requireUser(locals.user, url);
	const list = await myNotifications(locals.db, u.id, BELL_PAGE);
	// only the ones shown here are marked read
	const unread = list.filter((n) => !n.readAt).map((n) => n.id);
	if (unread.length) await markRead(locals.db, u.id, unread);
	return {
		list: list.map((n) => ({
			id: n.id,
			title: n.title,
			body: n.body,
			// only links inside Tutora
			link: n.link ? safeNext(n.link, '') || null : null,
			unread: !n.readAt,
			createdAt: n.createdAt
		}))
	};
};
