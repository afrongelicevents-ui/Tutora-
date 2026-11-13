import { fail } from '@sveltejs/kit';
import { notifyUser } from '#lib/server/notify.ts';
import { m } from '#lib/paraglide/messages.js';
import type { Actions, PageServerLoad } from './$types';
import { requireOwner } from '#lib/server/guards.ts';
import { allStudents, audit, setStudentSuspended } from '#lib/server/owner.ts';
import { formObject } from '#lib/validation/auth.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	requireOwner(locals.user, url);
	const q = (url.searchParams.get('q') ?? '').slice(0, 60);
	return { q, students: await allStudents(locals.db, q) };
};

export const actions: Actions = {
	suspend: async ({ locals, url, request }) => {
		const me = requireOwner(locals.user, url);
		const f = formObject(await request.formData());
		const on = f.suspend === 'true';
		if (!(await setStudentSuspended(locals.db, f.id ?? '', on)))
			return fail(404, { error: 'err_not_found' });
		await audit(locals.db, me.id, on ? 'student_suspended' : 'student_restored', f.id ?? '');
		if (!on)
			await notifyUser(locals.db, f.id ?? '', m.ev_restored_s(), m.ev_restored_b(), {
				kind: 'account'
			});
		return { saved: true };
	}
};
