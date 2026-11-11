import type { Actions, PageServerLoad } from './$types';
import { allReviews, setReviewHidden } from '#lib/server/people.ts';
import { requireTutor } from '#lib/server/guards.ts';
import { formObject } from '#lib/validation/auth.ts';

export const load: PageServerLoad = async ({ locals }) => ({
	reviews: await allReviews(locals.db)
});

export const actions: Actions = {
	toggle: async ({ locals, url, request }) => {
		requireTutor(locals.user, url);
		const f = formObject(await request.formData());
		const id = Number(f.id);
		if (Number.isInteger(id)) await setReviewHidden(locals.db, id, f.hidden === 'true');
		return { saved: true };
	}
};
