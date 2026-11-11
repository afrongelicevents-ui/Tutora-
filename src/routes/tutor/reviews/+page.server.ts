import type { Actions, PageServerLoad } from './$types';
import { allReviews, setReviewHidden } from '#lib/server/people.ts';
import { requireTutor } from '#lib/server/guards.ts';
import { formObject } from '#lib/validation/auth.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	const t = requireTutor(locals.user, url).id;
	return {
		reviews: await allReviews(locals.db, t)
	};
};

export const actions: Actions = {
	toggle: async ({ locals, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		const f = formObject(await request.formData());
		const id = Number(f.id);
		if (Number.isInteger(id)) await setReviewHidden(locals.db, t, id, f.hidden === 'true');
		return { saved: true };
	}
};
