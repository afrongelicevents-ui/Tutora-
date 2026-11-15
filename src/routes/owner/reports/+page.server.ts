import { fail } from '@sveltejs/kit';
import { reviewModerated, supportClosed } from '#lib/server/events.ts';
import type { Actions, PageServerLoad } from './$types';
import { requireOwner } from '#lib/server/guards.ts';
import {
	audit,
	closeSupport,
	dismissReport,
	openSupport,
	reopenSupport,
	reportedReviews,
	reviewLabel
} from '#lib/server/owner.ts';
import { setReviewHidden } from '#lib/server/people.ts';
import { formObject } from '#lib/validation/auth.ts';
import { doneFrom, doneRedirect } from '../done.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	requireOwner(locals.user, url);
	const [reviews, support] = await Promise.all([
		reportedReviews(locals.db),
		openSupport(locals.db)
	]);
	return { reviews, support, done: doneFrom(url) };
};

const idOf = (f: Record<string, string>) => Number(f.id) || 0;

export const actions: Actions = {
	/** Hide or show a review. The report (and its reason) is kept, so it can be undone. */
	hide: async ({ locals, url, request }) => {
		const me = requireOwner(locals.user, url);
		const f = formObject(await request.formData());
		const id = idOf(f);
		const hidden = f.hidden === 'true';
		const label = await reviewLabel(locals.db, id);
		if (!label) return fail(404, { error: 'err_not_found' });
		await setReviewHidden(locals.db, id, hidden);
		await audit(locals.db, me.id, hidden ? 'review_hidden' : 'review_shown', String(id), label);
		await reviewModerated(locals.db, id, hidden);
		doneRedirect(url, hidden ? 'or_done_hidden' : 'or_done_shown');
	},
	/** The report was not a problem: the review stays, the report is closed. */
	dismiss: async ({ locals, url, request }) => {
		const me = requireOwner(locals.user, url);
		const id = idOf(formObject(await request.formData()));
		const label = await reviewLabel(locals.db, id);
		if (!label) return fail(404, { error: 'err_not_found' });
		await dismissReport(locals.db, id);
		await audit(locals.db, me.id, 'report_dismissed', String(id), label);
		doneRedirect(url, 'or_done_kept');
	},
	close: async ({ locals, url, request }) => {
		const me = requireOwner(locals.user, url);
		const id = idOf(formObject(await request.formData()));
		const r = await closeSupport(locals.db, id);
		if (!r) return fail(404, { error: 'err_not_found' });
		await supportClosed(locals.db, id);
		await audit(locals.db, me.id, 'support_done', String(id), `${r.name} · ${r.topic}`);
		doneRedirect(url, 'or_done_closed');
	},
	/** Marked done by mistake. */
	reopen: async ({ locals, url, request }) => {
		const me = requireOwner(locals.user, url);
		const id = idOf(formObject(await request.formData()));
		const r = await reopenSupport(locals.db, id);
		if (!r) return fail(404, { error: 'err_not_found' });
		await audit(locals.db, me.id, 'support_reopened', String(id), `${r.name} · ${r.topic}`);
		doneRedirect(url, 'or_done_reopened');
	}
};
