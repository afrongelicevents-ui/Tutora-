import type { Actions, PageServerLoad } from './$types';
import { loadPeople, makeResetLink, resetPassword, suspendPerson } from '../people.ts';

/** People → Students. */
export const load: PageServerLoad = (ev) => loadPeople(ev, 'student');
export const actions: Actions = {
	suspend: suspendPerson,
	resetStudent: resetPassword,
	resetLink: makeResetLink
};
