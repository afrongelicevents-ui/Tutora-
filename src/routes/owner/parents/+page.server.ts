import type { Actions, PageServerLoad } from './$types';
import { loadPeople, resetPassword, suspendPerson } from '../people.ts';

/** People → Parents. */
export const load: PageServerLoad = (ev) => loadPeople(ev, 'parent');
export const actions: Actions = { suspend: suspendPerson, resetStudent: resetPassword };
