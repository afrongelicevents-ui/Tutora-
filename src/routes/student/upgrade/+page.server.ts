import type { Actions, PageServerLoad } from './$types';
import { familyActions, familyLoad } from '#lib/server/family-pages.ts';

/**
 * Where a locked Tutora Family page sends a student. Under 18, or with a parent connected:
 * "Ask your parent about Tutora Family". 18+ with no parent: they can pay for themselves.
 */
export const load: PageServerLoad = async (event) => ({
	...(await familyLoad(event, ['student'])),
	sent: event.url.searchParams.has('sent')
});

const a = familyActions(['student']);
export const actions: Actions = { invoice: a.invoice, proof: a.proof };
