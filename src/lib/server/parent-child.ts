import type { Cookies } from '@sveltejs/kit';
import { dev } from '$app/env';
import type { DB } from './db/types.ts';
import { childrenOf } from './family.ts';
import { shortName } from '../names.ts';

const COOKIE = 'tutora_child';

/**
 * The parent's children and which one is selected (?child=, else the last one chosen, else
 * the first). Switching children needs no sign-out; only active links count.
 */
export async function pickChild(db: DB, parentId: string, url: URL, cookies: Cookies) {
	const all = await childrenOf(db, parentId);
	const active = all.filter((c) => c.status === 'active');
	const wanted = url.searchParams.get('child') ?? cookies.get(COOKIE) ?? null;
	const current = active.find((c) => c.studentId === wanted) ?? active[0] ?? null;
	if (current && url.searchParams.get('child') === current.studentId)
		cookies.set(COOKIE, current.studentId, {
			path: '/parent',
			httpOnly: true,
			secure: !dev,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 180
		});
	return {
		kids: all.map((c) => ({
			id: c.studentId,
			name: shortName(c.name),
			level: c.level,
			status: c.status,
			guardian: c.guardian,
			managed: !!c.managed
		})),
		current: current?.studentId ?? null
	};
}
