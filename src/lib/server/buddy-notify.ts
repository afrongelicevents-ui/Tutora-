/** Turns Study Buddies events into in-app notifications (with email where the person allows). */
import { eq } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { user } from './db/auth.schema.ts';
import type { Notice } from './buddies.ts';
import { notifyUser } from './notify.ts';
import { m } from '../paraglide/messages.js';

const TEXT: Record<Notice['key'], [(v: never) => string, (v: never) => string]> = {
	bn_request_parent: [m.bn_request_parent_s, m.bn_request_parent_b],
	bn_added_parent: [m.bn_added_parent_s, m.bn_added_parent_b],
	bn_new: [m.bn_new_s, m.bn_new_b],
	bn_waiting: [m.bn_waiting_s, m.bn_waiting_b],
	bn_approved: [m.bn_approved_s, m.bn_approved_b],
	bn_report: [m.bn_report_s, m.bn_report_b]
};

export async function sendNotices(db: DB, notices: Notice[]) {
	for (const n of notices) {
		const [s, b] = TEXT[n.key];
		const v = n.values as never;
		await notifyUser(db, n.userId, s(v), b(v), { kind: 'family', link: n.link });
	}
}

/** Tell the Tutora owner(s) that something is waiting in the profile-check queue. */
export async function tellOwners(db: DB) {
	const owners: { id: string }[] = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.role, 'owner'));
	await sendNotices(
		db,
		owners.map((o) => ({
			userId: o.id,
			key: 'bn_report' as const,
			values: {},
			link: '/owner/moderation'
		}))
	);
}
