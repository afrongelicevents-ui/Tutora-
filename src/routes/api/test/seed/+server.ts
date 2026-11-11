import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { CRON_SECRET, TEST_SITE } from '$app/env/private';
import type { RequestHandler } from './$types';
import { seedTestData } from '#lib/server/seed.ts';
import { user } from '#lib/server/db/auth.schema.ts';

function sameText(a: string, b: string) {
	if (a.length !== b.length) return false;
	let r = 0;
	for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return r === 0;
}

/**
 * Fills the TEST site with fake data (called by the deploy workflow). Does not exist on the
 * live site. With ?ifEmpty=1 it only runs when there is no data yet, so testers' changes
 * survive later deploys.
 */
export const POST: RequestHandler = async ({ locals, request, url }) => {
	if (TEST_SITE !== '1') error(404, 'Not found');
	const given = request.headers.get('authorization') ?? '';
	if (!CRON_SECRET || CRON_SECRET.length < 24 || !sameText(given, `Bearer ${CRON_SECRET}`))
		error(404, 'Not found');
	if (url.searchParams.get('ifEmpty') === '1') {
		const [owner] = await locals.db
			.select({ id: user.id })
			.from(user)
			.where(eq(user.role, 'owner'));
		if (owner) return json({ seeded: false });
	}
	const logins = await seedTestData(locals.db, locals.auth, { testSite: true });
	return json({ seeded: true, logins: logins.length });
};
