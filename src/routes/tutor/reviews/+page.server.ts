import type { Actions, PageServerLoad } from './$types';
import { reviewReplied } from '#lib/server/events.ts';
import { allReviews, replyToReview, reportReview } from '#lib/server/people.ts';
import { notifyOwners } from '#lib/server/notify.ts';
import { m } from '#lib/paraglide/messages.js';
import { fail } from '@sveltejs/kit';
import { requireTutor } from '#lib/server/guards.ts';
import { formObject } from '#lib/validation/auth.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	const t = requireTutor(locals.user, url).id;
	return {
		reviews: await allReviews(locals.db, t)
	};
};

export const actions: Actions = {
	reply: async ({ locals, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		const f = formObject(await request.formData());
		const id = Number(f.id);
		if (!Number.isInteger(id)) return fail(400, { error: 'err_generic' });
		const text = f.reply?.trim().slice(0, 600) || null;
		await replyToReview(locals.db, t, id, text);
		if (text) await reviewReplied(locals.db, id);
		return { saved: true };
	},
	report: async ({ locals, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		const f = formObject(await request.formData());
		const id = Number(f.id);
		const reason = f.reason?.trim().slice(0, 300) ?? '';
		if (!Number.isInteger(id) || reason.length < 3)
			return fail(400, { error: 'err_report_reason' });
		if (!(await reportReview(locals.db, t, id, reason)))
			return fail(404, { error: 'err_not_found' });
		await notifyOwners(
			locals.db,
			m.owner_report_s(),
			m.owner_report_b({ reason }),
			'/owner/reports'
		);
		return { reported: true };
	}
};
