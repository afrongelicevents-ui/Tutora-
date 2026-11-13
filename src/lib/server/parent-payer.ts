import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { user } from './db/auth.schema.ts';
import { parentAccess } from './family.ts';
import type { Payer } from './payments-page.ts';

/**
 * Whose payments a parent is looking at: ?child=<id> for a child they are guardian of
 * (paying on the child's behalf), otherwise their own account (older records from before
 * Family Connection, when parents booked themselves).
 */
export async function parentPayer(
	db: DB,
	parent: { id: string; name: string },
	url: URL
): Promise<Payer> {
	const childId = url.searchParams.get('child');
	if (!childId) return { id: parent.id, name: parent.name };
	const a = await parentAccess(db, parent.id, childId);
	if (!a.ok || !a.guardian) error(404, 'Not found');
	const [c] = await db.select({ name: user.name }).from(user).where(eq(user.id, childId));
	return { id: childId, name: c?.name ?? '', paidBy: parent.name };
}
