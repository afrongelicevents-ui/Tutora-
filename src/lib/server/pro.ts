/**
 * Tutora Pro ($5/month for tutors). Who has Pro: `proAccess(db, tutorId)`.
 *
 * CONTRACT (used by other modules; keep the signature):
 *   proAccess(db, tutorId) → { active: boolean; state: 'trial' | 'paid' | 'grace' | 'gift' | 'free' }
 *
 * The Tutora Pro worker replaces the body with the real rules (pilot trial switch, paid
 * period + 7 days grace, owner gifts). Until then: everyone is Pro (like the pilot default).
 */
import type { DB } from './db/types.ts';

export type ProState = 'trial' | 'paid' | 'grace' | 'gift' | 'free';
export interface ProAccess {
	active: boolean;
	state: ProState;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function proAccess(db: DB, tutorId: string): Promise<ProAccess> {
	return { active: true, state: 'trial' };
}
