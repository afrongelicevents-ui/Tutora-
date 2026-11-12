import type { PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { mySubjects } from '#lib/server/student-home.ts';
import { subjectOptions } from '#lib/server/settings.ts';

/** All subjects: the student's own (from their records), then the ones taught on Tutora. */
export const load: PageServerLoad = async ({ locals, url }) => {
	const u = requireRole(locals.user, url, ['student']);
	const [mine, platform] = await Promise.all([
		mySubjects(locals.db, u.id),
		subjectOptions(locals.db)
	]);
	const seen = new Set(mine.map((s) => s.toLowerCase()));
	return { mine, explore: platform.filter((s) => !seen.has(s.toLowerCase())) };
};
