import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { proActions, proLoad } from '#lib/server/pro-pages.ts';

/** Pay for Tutora Pro: Tutora's payment details and the proof upload for one invoice. */
export const load: PageServerLoad = async (event) => {
	const d = await proLoad(event);
	if (!d.invoice) redirect(303, '/tutor/pro');
	return d;
};

export const actions: Actions = { proof: proActions.proof };
