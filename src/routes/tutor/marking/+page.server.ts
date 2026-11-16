import type { PageServerLoad } from './$types';
import { requireTutor } from '#lib/server/guards.ts';
import { closeExpired, markingList } from '#lib/server/tests.ts';

/** Handed-in tests: written answers to mark first, then the latest. */
export const load: PageServerLoad = async ({ locals, url }) => {
	const t = requireTutor(locals.user, url).id;
	await closeExpired(locals.db, t);
	return { list: await markingList(locals.db, t) };
};
