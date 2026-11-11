import type { PageServerLoad } from './$types';
import { requireUser, safeNext } from '#lib/server/guards.ts';
import { markRead, myNotifications } from '#lib/server/notify.ts';

/** My notifications (the bell). Opening the list marks them as read. */
export const load: PageServerLoad = async ({ locals, url }) => {
	const u = requireUser(locals.user, url);
	const list = await myNotifications(locals.db, u.id, 50);
	if (list.some((n) => !n.readAt)) await markRead(locals.db, u.id);
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
