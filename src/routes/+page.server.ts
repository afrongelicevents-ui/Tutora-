import type { PageServerLoad } from './$types';
import { allSubjectNames, listTutors } from '#lib/server/settings.ts';

/** Tutora's homepage: what Tutora is, and "Find a tutor" with a subject filter. */
export const load: PageServerLoad = async ({ locals, url }) => {
	const subject = (url.searchParams.get('subject') ?? '').trim().slice(0, 60);
	const [tutors, subjects] = await Promise.all([
		listTutors(locals.db, subject),
		allSubjectNames(locals.db)
	]);
	return {
		subject,
		subjects,
		// only what a card needs (no internal ids)
		tutors: tutors.map(({ tutorId: _id, ...t }) => t)
	};
};
