import type { Actions, PageServerLoad } from './$types';
import { familyActions, familyLoad } from '#lib/server/family-pages.ts';

/** Choose children and period → invoice → Tutora's payment details and proof upload. */
export const load: PageServerLoad = (event) => familyLoad(event, ['parent']);

const a = familyActions(['parent']);
export const actions: Actions = { invoice: a.invoice, proof: a.proof };
