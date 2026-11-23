/** Shared by People → Students, Parents and Schoolteachers: the list and its actions. */
import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { requireOwner } from '#lib/server/guards.ts';
import { audit, setStudentSuspended } from '#lib/server/owner.ts';
import { pageFrom, peopleList, searchFrom, type PeopleRole } from '#lib/server/owner-admin.ts';
import { notifyUser } from '#lib/server/notify.ts';
import { createResetLink, ResetLinkFail } from '#lib/server/reset-links.ts';
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

/** What the owner sees after making a reset link: Copy and Share on WhatsApp. */
function linkResult(origin: string, forId: string, r: Awaited<ReturnType<typeof createResetLink>>) {
	const link = `${origin}/reset/${r.token}`;
	const text = m.rl_wa_text({ name: r.name.split(' ')[0] || r.name, link });
	const wa = `https://wa.me/${r.phone ?? ''}?text=${encodeURIComponent(text)}`;
	return { resetLink: { for: forId, name: r.name, link, wa } };
}

/**
 * "Reset password" on a person's card: a one-time link (24 hours) the owner copies or sends
 * on WhatsApp. Nothing changes for the person until they use it.
 */
export async function makeResetLink({ locals, url, request }: RequestEvent) {
	const me = requireOwner(locals.user, url);
	const f = formObject(await request.formData());
	const id = (f.id ?? '').trim();
	if (!id) return fail(400, { error: 'err_generic' });
	try {
		const r = await createResetLink(locals.db, me.id, id);
		return linkResult(url.origin, id, r);
	} catch (e) {
		if (e instanceof ResetLinkFail) return fail(400, { error: e.code, resetFor: id });
		throw e;
	}
}

/** "Reset a password" by email (any account but the owner's): the same one-time link. */
export async function resetPassword({ locals, url, request }: RequestEvent) {
	const me = requireOwner(locals.user, url);
	const f = formObject(await request.formData());
	if (!(f.email ?? '').trim()) return fail(400, { resetError: 'err_required' });
	const email = emailField.safeParse(f.email ?? '');
	if (!email.success) return fail(400, { resetError: 'err_email' });
	const [u] = await locals.db
		.select({ id: user.id, role: user.role })
		.from(user)
		.where(eq(user.email, email.data.toLowerCase()));
	if (!u || u.role === 'owner')
		return fail(404, { resetError: 'owner_reset_none', resetEmail: email.data });
	try {
		const r = await createResetLink(locals.db, me.id, u.id);
		return linkResult(url.origin, u.id, r);
	} catch (e) {
		if (e instanceof ResetLinkFail)
			return fail(400, { resetError: e.code, resetEmail: email.data });
		throw e;
	}
}
