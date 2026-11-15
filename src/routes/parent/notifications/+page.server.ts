import type { PageServerLoad } from './$types';
import { requireRole, safeNext } from '#lib/server/guards.ts';
import { BELL_PAGE, markRead, myNotifications, unreadCount } from '#lib/server/notify.ts';
import { childUpdates } from '#lib/server/parent.ts';
import { pickChild } from '#lib/server/parent-child.ts';

/** The bell for families: notifications (marked read when shown) and the child's recent activity. */
export const load: PageServerLoad = async ({ locals, url, cookies }) => {
	const u = requireRole(locals.user, url, ['parent']);
	const [list, picked] = await Promise.all([
		myNotifications(locals.db, u.id, BELL_PAGE),
		pickChild(locals.db, u.id, url, cookies)
	]);
	const unread = list.filter((n) => !n.readAt).map((n) => n.id);
	if (unread.length) await markRead(locals.db, u.id, unread);
	const [items, unreadNow] = await Promise.all([
		picked.current ? childUpdates(locals.db, u.id, picked.current) : Promise.resolve(null),
		unread.length ? unreadCount(locals.db, u.id) : Promise.resolve(null)
	]);
	return {
		list: list.map((n) => ({
			id: n.id,
			title: n.title,
			body: n.body,
			kind: n.kind,
			link: n.link ? safeNext(n.link, '') || null : null,
			unread: !n.readAt,
			createdAt: n.createdAt
		})),
		kids: picked.kids,
		current: picked.current,
		items: (items ?? []).slice(0, 30),
		...(unreadNow !== null ? { unreadNow } : {})
	};
};
