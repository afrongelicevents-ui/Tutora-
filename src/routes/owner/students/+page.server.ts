import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { notifyUser } from '#lib/server/notify.ts';
import { m } from '#lib/paraglide/messages.js';
import type { Actions, PageServerLoad } from './$types';
import { requireOwner } from '#lib/server/guards.ts';
import { allStudents, audit, setStudentSuspended } from '#lib/server/owner.ts';
import { user } from '#lib/server/db/auth.schema.ts';
import { formObject } from '#lib/validation/auth.ts';
import { doneFrom } from '../done.ts';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, url }) => {
	requireOwner(locals.user, url);
	const q = (url.searchParams.get('q') ?? '').slice(0, 60);
	return { q, students: await allStudents(locals.db, q), done: doneFrom(url) };
};

export const actions: Actions = {
	suspend: async ({ locals, url, request }) => {
		const me = requireOwner(locals.user, url);
		const f = formObject(await request.formData());
		const on = f.suspend === 'true';
		// suspending logs the person out at once: the owner ticks "I'm sure" first
		if (on && f.sure !== 'on') return fail(400, { error: 'err_tick_sure', suspendFor: f.id });
		const [who] = await locals.db
			.select({ name: user.name, email: user.email })
			.from(user)
			.where(eq(user.id, f.id ?? ''));
		if (!(await setStudentSuspended(locals.db, f.id ?? '', on)))
			return fail(404, { error: 'err_not_found' });
		await audit(
			locals.db,
			me.id,
			on ? 'student_suspended' : 'student_restored',
			f.id ?? '',
			who ? `${who.name} · ${who.email}` : null
		);
		if (!on)
			await notifyUser(locals.db, f.id ?? '', m.ev_restored_s(), m.ev_restored_b(), {
				kind: 'account'
			});
		const q = url.searchParams.get('q');
		redirect(
			303,
			`${url.pathname}?done=${on ? 'owner_done_suspended' : 'owner_done_restored'}${q ? `&q=${encodeURIComponent(q)}` : ''}`
		);
	}
};
