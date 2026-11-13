import { reviewModerated, supportClosed } from '#lib/server/events.ts';
import type { Actions, PageServerLoad } from './$types';
import { requireOwner } from '#lib/server/guards.ts';
import {
	audit,
	closeSupport,
	dismissReport,
	openSupport,
	reportedReviews
} from '#lib/server/owner.ts';
import { setReviewHidden } from '#lib/server/people.ts';
import { formObject } from '#lib/validation/auth.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	requireOwner(locals.user, url);
	const [reviews, support] = await Promise.all([
		reportedReviews(locals.db),
		openSupport(locals.db)
	]);
	return { reviews, support };
};

export const actions: Actions = {
	hide: async ({ locals, url, request }) => {
		const me = requireOwner(locals.user, url);
		const f = formObject(await request.formData());
		const id = Number(f.id) || 0;
		const hidden = f.hidden === 'true';
		await setReviewHidden(locals.db, id, hidden);
		if (hidden) await dismissReport(locals.db, id);
		await audit(locals.db, me.id, hidden ? 'review_hidden' : 'review_shown', String(id));
		await reviewModerated(locals.db, id, hidden);
		return { saved: true };
	},
	dismiss: async ({ locals, url, request }) => {
		const me = requireOwner(locals.user, url);
		const id = Number(formObject(await request.formData()).id) || 0;
		await dismissReport(locals.db, id);
		await audit(locals.db, me.id, 'report_dismissed', String(id));
		return { saved: true };
	},
	close: async ({ locals, url, request }) => {
		const me = requireOwner(locals.user, url);
		const id = Number(formObject(await request.formData()).id) || 0;
		await closeSupport(locals.db, id);
		await supportClosed(locals.db, id);
		await audit(locals.db, me.id, 'support_done', String(id));
		return { saved: true };
	}
};
