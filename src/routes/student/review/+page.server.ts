import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { canReview, myReview, postReview } from '#lib/server/people.ts';
import { requireRole } from '#lib/server/guards.ts';
import { formObject } from '#lib/validation/auth.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	requireRole(locals.user, url, ['student', 'parent']);
	const u = locals.user!;
	return { allowed: await canReview(locals.db, u.id), mine: await myReview(locals.db, u.id) };
};

const schema = z.object({
	rating: z.coerce.number().int().min(1).max(5),
	text: z.string().trim().min(5, 'err_review_short').max(600, 'err_too_long')
});

export const actions: Actions = {
	default: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['student', 'parent']);
		const p = schema.safeParse(formObject(await request.formData()));
		if (!p.success)
			return fail(400, {
				error: p.error.issues[0].message.startsWith('err_')
					? p.error.issues[0].message
					: 'err_review_short'
			});
		const r = await postReview(locals.db, u.id, u.name, p.data.rating, p.data.text);
		if (!r) return fail(403, { error: 'err_review_not_allowed' });
		redirect(303, '/student/review?thanks=1');
	}
};
