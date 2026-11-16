import type { Actions, PageServerLoad } from './$types';
import { familyActions, familyLoad } from '#lib/server/family-pages.ts';

/** Tutora Family: what is free, what the plan adds, the prices. */
export const load: PageServerLoad = (event) => familyLoad(event, ['parent']);

export const actions: Actions = { trial: familyActions(['parent']).trial };
