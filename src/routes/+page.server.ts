import type { PageServerLoad } from './$types';
import { popularTutors } from '#lib/server/settings.ts';
import { getContent } from '#lib/server/content.ts';

/** Tutora's homepage: what Tutora is, popular (real, approved) tutors, and "Are you a tutor?". */
export const load: PageServerLoad = async ({ locals }) => {
	const [tutors, content] = await Promise.all([popularTutors(locals.db), getContent(locals.db)]);
	return {
		content: {
			heroTitle: content.heroTitle,
			heroLead: content.heroLead,
			joinLead: content.joinLead,
			heroPhotoV: content.heroPhoto ? content.heroPhotoV : null
		},
		// only what a card needs (no internal ids)
		tutors: tutors.map(({ tutorId: _id, bio: _b, ...t }) => t)
	};
};
