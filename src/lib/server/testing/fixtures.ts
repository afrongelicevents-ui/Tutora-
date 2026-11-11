import { user } from '../db/auth.schema.ts';
import { enrollment, profile } from '../db/app.schema.ts';
import type { DB } from '../db/types.ts';
import { createTutorProfile } from '../settings.ts';
import { fromLocal } from '../../tz.ts';

let n = 0;
/** The tutor made last; students made afterwards are enrolled with them (tests only). */
let lastTutor: string | null = null;

/**
 * Insert a user directly (tests only). Tutors get an approved profile. Students and parents
 * are linked to `tutorId` (default: the tutor made last); pass null for nobody.
 */
export async function makeUser(
	db: DB,
	role: 'tutor' | 'student' | 'parent' | 'owner',
	name = `Person ${++n}`,
	tutorId: string | null | undefined = undefined
) {
	const id = `u_${role}_${++n}_${Math.random().toString(36).slice(2, 7)}`;
	const twoFactorEnabled = role === 'tutor' || role === 'owner';
	await db.insert(user).values({
		id,
		name,
		email: `${id}@example.com`,
		emailVerified: true,
		role,
		twoFactorEnabled
	});
	if (role === 'tutor') {
		await createTutorProfile(db, id, name, 'active');
		lastTutor = id;
	}
	if (role === 'student' || role === 'parent') {
		await db.insert(profile).values({ userId: id, consentAt: new Date() });
		const t = tutorId === undefined ? lastTutor : tutorId;
		if (t) await db.insert(enrollment).values({ tutorId: t, userId: id });
	}
	return {
		id,
		name,
		role,
		twoFactorEnabled,
		tutorStatus: role === 'tutor' ? ('active' as const) : null
	};
}

/** Monday 16 Nov 2026, 08:00 Zimbabwe time. */
export const MONDAY_8AM = fromLocal('2026-11-16', 8 * 60);
/** Zimbabwe local time helper: day offset from Monday 16 Nov 2026 and "HH:MM". */
export function zw(dayOffset: number, hhmm: string) {
	const [h, m] = hhmm.split(':').map(Number);
	const d = new Date(Date.UTC(2026, 10, 16 + dayOffset));
	return fromLocal(d.toISOString().slice(0, 10), h * 60 + m);
}
