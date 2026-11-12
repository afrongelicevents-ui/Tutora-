import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { canReview, myReview, myTutor, postReview } from '#lib/server/people.ts';
import { requireRole } from '#lib/server/guards.ts';
import { formObject } from '#lib/validation/auth.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	requireRole(locals.user, url, ['student']);
	const u = locals.user!;
	const tutor = await myTutor(locals.db, u.id, url.searchParams.get('tutor'));
	if (!tutor) redirect(303, '/student');
	return {
		tutorName: tutor.name,
		allowed: tutor.status === 'active' && (await canReview(locals.db, tutor.tutorId, u.id)),
		mine: await myReview(locals.db, tutor.tutorId, u.id)
	};
};

const schema = z.object({
	rating: z.coerce.number().int().min(1).max(5),
	text: z.string().trim().min(5, 'err_review_short').max(600, 'err_too_long')
});

export const actions: Actions = {
	default: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['student']);
		const tutor = await myTutor(locals.db, u.id, url.searchParams.get('tutor'));
		if (!tutor || tutor.status !== 'active') return fail(403, { error: 'err_review_not_allowed' });
		const p = schema.safeParse(formObject(await request.formData()));
		if (!p.success)
			return fail(400, {
				error: p.error.issues[0].message.startsWith('err_')
					? p.error.issues[0].message
					: 'err_review_short'
			});
		const r = await postReview(locals.db, tutor.tutorId, u.id, u.name, p.data.rating, p.data.text);
		if (!r) return fail(403, { error: 'err_review_not_allowed' });
		redirect(303, `/student/review?tutor=${tutor.slug}&thanks=1`);
	}
};
