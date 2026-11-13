import type { PageServerLoad } from './$types';
import { getContent } from '#lib/server/content.ts';

/** The owner's own "join as a tutor" wording (Owner → Content); empty = the built-in text. */
export const load: PageServerLoad = async ({ locals }) => {
	const c = await getContent(locals.db);
	return { joinLead: c.joinLead || null };
};
