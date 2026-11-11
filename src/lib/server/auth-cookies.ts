import type { Cookies } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { session } from './db/schema.ts';

const NAMES = ['session_token', 'session_data', 'dont_remember'];

/**
 * Logs a user out everywhere and removes the login cookies from this response. Used after the
 * server changes someone's role straight after sign-up, because the login cookie briefly
 * remembers the old role.
 */
export async function endLogin(db: DB, cookies: Cookies, userId: string) {
	await db.delete(session).where(eq(session.userId, userId));
	for (const n of NAMES) {
		for (const prefix of ['better-auth.', '__Secure-better-auth.']) {
			cookies.delete(prefix + n, { path: '/' });
		}
	}
}
