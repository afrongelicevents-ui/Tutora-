import type { Actions, PageServerLoad } from './$types';
import { proActions, proLoad } from '#lib/server/pro-pages.ts';

/** Tutora Pro: Free vs Pro, the price, the trial, choosing a period, Pro settings. */
export const load: PageServerLoad = (event) => proLoad(event);

export const actions: Actions = {
	trial: proActions.trial,
	invoice: proActions.invoice,
	prefs: proActions.prefs
};
