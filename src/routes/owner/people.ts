/** Shared by People → Students, Parents and Schoolteachers: the list and its actions. */
import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { requireOwner } from '#lib/server/guards.ts';
import { audit, setStudentSuspended } from '#lib/server/owner.ts';
import { pageFrom, peopleList, searchFrom, type PeopleRole } from '#lib/server/owner-admin.ts';
import { notifyUser } from '#lib/server/notify.ts';
import { setPasswordFor, studentByEmail, tempPassword } from '#lib/server/account.ts';
import { user } from '#lib/server/db/auth.schema.ts';
import { formObject, newEmailField as emailField } from '#lib/validation/auth.ts';
import { m } from '#lib/paraglide/messages.js';
import { doneFrom } from './done.ts';

export async function loadPeople({ locals, url }: RequestEvent, role: PeopleRole) {
	requireOwner(locals.user, url);
	const raw = url.searchParams.get('state') ?? '';
	const state = raw === 'active' || raw === 'suspended' ? raw : '';
	const q = searchFrom(url);
	const { page, limit, offset } = pageFrom(url);
	const r = await peopleList(locals.db, role, { q, state, limit, offset });
	return { people: r.rows, counts: r.counts, total: r.total, state, q, page, done: doneFrom(url) };
}

/** Suspend (two steps: "I'm sure") or restore an account; back to the same list. */
export async function suspendPerson({ locals, url, request }: RequestEvent) {
	const me = requireOwner(locals.user, url);
	const f = formObject(await request.formData());
	const on = f.suspend === 'true';
	// suspending logs the person out at once: the owner ticks "I'm sure" first
	if (on && f.sure !== 'on') return fail(400, { error: 'err_tick_sure', suspendFor: f.id });
	const [who] = await locals.db
		.select({ name: user.name, email: user.email, role: user.role })
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
	const back = new URLSearchParams();
	back.set('done', on ? 'owner_done_suspended' : 'owner_done_restored');
	const q = f.q || url.searchParams.get('q');
	const state = f.state || url.searchParams.get('state');
	if (q) back.set('q', q.slice(0, 60));
	if (state === 'active' || state === 'suspended') back.set('state', state);
	redirect(303, `${url.pathname}?${back}`);
}

/** A temporary password for a student or parent who forgot theirs (shown once). */
export async function resetPassword({ locals, url, request }: RequestEvent) {
	const me = requireOwner(locals.user, url);
	const f = formObject(await request.formData());
	if (!(f.email ?? '').trim()) return fail(400, { resetError: 'err_required' });
	const email = emailField.safeParse(f.email ?? '');
	if (!email.success) return fail(400, { resetError: 'err_email' });
	// the person's password changes at once: the owner ticks "I'm sure" first
	if (f.sure !== 'on') return fail(400, { resetError: 'err_tick_sure', resetEmail: email.data });
	const s = await studentByEmail(locals.db, email.data);
	if (!s) return fail(404, { resetError: 'owner_reset_none' });
	const password = tempPassword();
	if (!(await setPasswordFor({ auth: locals.auth, db: locals.db }, s.id, password)))
		return fail(400, { resetError: 'owner_reset_none' });
	// tell the account holder (by email, when email is switched on)
	await notifyUser(locals.db, s.id, m.email_pw_reset_s(), m.email_pw_reset_b());
	await audit(locals.db, me.id, 'password_reset', s.id, s.name);
	// shown once to the owner; the student must change it at their next login
	return { reset: { name: s.name, password } };
}
