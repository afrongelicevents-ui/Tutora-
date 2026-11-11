import { eq } from 'drizzle-orm';
import { user } from '../db/auth.schema.ts';
import { profile } from '../db/app.schema.ts';
import type { DB } from '../db/types.ts';
import { fromLocal } from '../../tz.ts';

let n = 0;

/** Insert a user directly (tests only). */
export async function makeUser(
	db: DB,
	role: 'tutor' | 'student' | 'parent',
	name = `Person ${++n}`
) {
	if (role === 'tutor') {
		// The database allows only one tutor: reuse it if a test already made one.
		const [t] = await db.select().from(user).where(eq(user.role, 'tutor'));
		if (t) return { id: t.id, name: t.name, role, twoFactorEnabled: true };
	}
	const id = `u_${role}_${++n}_${Math.random().toString(36).slice(2, 7)}`;
	await db.insert(user).values({
		id,
		name,
		email: `${id}@example.com`,
		emailVerified: true,
		role,
		twoFactorEnabled: role === 'tutor'
	});
	if (role !== 'tutor') await db.insert(profile).values({ userId: id, consentAt: new Date() });
	return { id, name, role, twoFactorEnabled: role === 'tutor' };
}

/** Monday 16 Nov 2026, 08:00 Zimbabwe time. */
export const MONDAY_8AM = fromLocal('2026-11-16', 8 * 60);
/** Zimbabwe local time helper: day offset from Monday 16 Nov 2026 and "HH:MM". */
export function zw(dayOffset: number, hhmm: string) {
	const [h, m] = hhmm.split(':').map(Number);
	const d = new Date(Date.UTC(2026, 10, 16 + dayOffset));
	return fromLocal(d.toISOString().slice(0, 10), h * 60 + m);
}
