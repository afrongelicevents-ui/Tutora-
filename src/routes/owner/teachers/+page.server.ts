import type { Actions, PageServerLoad } from './$types';
import { loadPeople, suspendPerson } from '../people.ts';

/** People → Schoolteachers (School+ accounts). */
export const load: PageServerLoad = (ev) => loadPeople(ev, 'schoolteacher');
export const actions: Actions = { suspend: suspendPerson };
