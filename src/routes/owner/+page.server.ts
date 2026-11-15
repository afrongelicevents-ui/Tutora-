import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { ORIGIN } from '$app/env/private';
import type { Actions, PageServerLoad } from './$types';
import { TEST_PASSWORD, TEST_SITE } from '$app/env/private';
import { requireOwner } from '#lib/server/guards.ts';
import {
	allTutors,
	audit,
	platformCounts,
	rejectTutor,
	setTutorStatus,
	tutorReadiness
} from '#lib/server/owner.ts';
import { doneFrom, doneRedirect } from './done.ts';
import { getSettings } from '#lib/server/settings.ts';
import { addTutorByOwner } from '#lib/server/actions/setup.ts';
import { setPasswordFor, studentByEmail, tempPassword } from '#lib/server/account.ts';
import { newEmailField as emailField } from '#lib/validation/auth.ts';
import { notifyUser } from '#lib/server/notify.ts';
import { m } from '#lib/paraglide/messages.js';
import { formObject } from '#lib/validation/auth.ts';
import { seedTestData } from '#lib/server/seed.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	requireOwner(locals.user, url);
	const [tutors, counts] = await Promise.all([allTutors(locals.db), platformCounts(locals.db)]);
	return {
		tutors: tutors.map((t) => ({ ...t, tutorId: t.tutorId })),
		counts,
		testSite: TEST_SITE === '1',
		done: doneFrom(url)
	};
};

const statusForm = z.object({
	id: z.string().min(1).max(100),
	status: z.enum(['active', 'suspended']),
	sure: z.string().optional()
});

export const actions: Actions = {
	status: async ({ locals, url, request }) => {
		const me = requireOwner(locals.user, url);
		const p = statusForm.safeParse(formObject(await request.formData()));
		if (!p.success) return fail(400, { error: 'err_generic' });
		const before = await getSettings(locals.db, p.data.id).catch(() => null);
		if (!before) return fail(404, { error: 'err_not_found' });
		// a profile only goes live through review: from "waiting" or back from "suspended"
		if (p.data.status === 'active' && before.status !== 'pending' && before.status !== 'suspended')
			return fail(400, { error: 'err_generic' });
		// suspending logs the tutor out at once: the owner ticks "I'm sure" first
		if (p.data.status === 'suspended' && p.data.sure !== 'on')
			return fail(400, { error: 'err_tick_sure', suspendFor: p.data.id });
		// approving: only a page students can actually find (same rule as "Find a tutor")
		const approving = p.data.status === 'active' && before.status === 'pending';
		if (approving) {
			const r = await tutorReadiness(locals.db, p.data.id);
			if (!r.ready)
				return fail(400, {
					error: r.missing.includes('subjects') ? 'owner_err_no_subjects' : 'owner_err_no_name',
					notReady: p.data.id
				});
		}
		const ok = await setTutorStatus(locals.db, p.data.id, p.data.status);
		if (!ok) return fail(404, { error: 'err_not_found' });
		const action = approving
			? 'tutor_approved'
			: p.data.status === 'active'
				? 'tutor_restored'
				: 'tutor_suspended';
		await audit(locals.db, me.id, action, p.data.id, before.tutorName ?? null);
		if (approving)
			await notifyUser(
				locals.db,
				p.data.id,
				m.tutor_approved_s(),
				m.tutor_approved_b({ url: `${ORIGIN ?? url.origin}/t/${before.slug}` }),
				{ kind: 'account', link: '/tutor' }
			);
		else if (p.data.status === 'active')
			// back from a pause: not a new welcome
			await notifyUser(locals.db, p.data.id, m.ev_tutor_restored_s(), m.ev_tutor_restored_b(), {
				kind: 'account',
				link: '/tutor'
			});
		else if (before.status === 'active')
			await notifyUser(locals.db, p.data.id, m.ev_tutor_suspended_s(), m.ev_tutor_suspended_b(), {
				kind: 'account',
				link: '/tutor-status'
			});
		doneRedirect(
			url,
			approving
				? 'owner_done_active'
				: p.data.status === 'active'
					? 'owner_done_restored'
					: 'owner_done_suspended'
		);
	},
	reject: async ({ locals, url, request }) => {
		const me = requireOwner(locals.user, url);
		const f = formObject(await request.formData());
		const reason = (f.reason ?? '').trim().slice(0, 500);
		if (reason.length < 3) return fail(400, { error: 'err_report_reason' });
		const before = await getSettings(locals.db, f.id ?? '').catch(() => null);
		if (!(await rejectTutor(locals.db, f.id ?? '', reason)))
			return fail(404, { error: 'err_not_found' });
		await audit(
			locals.db,
			me.id,
			'tutor_rejected',
			f.id ?? '',
			`${before?.tutorName ?? '—'}: ${reason}`
		);
		await notifyUser(locals.db, f.id ?? '', m.tutor_rejected_s(), m.ts_rejected({ reason }), {
			kind: 'account',
			link: '/tutor'
		});
		doneRedirect(url, 'owner_done_rejected');
	},
	addTutor: async ({ locals, url, request }) => {
		const me = requireOwner(locals.user, url);
		const f = formObject(await request.formData());
		const password = tempPassword();
		const r = await addTutorByOwner(
			{ auth: locals.auth, db: locals.db },
			{ name: f.name ?? '', email: f.email ?? '', password }
		);
		if (!r.ok)
			return fail(400, {
				addErrors: r.errors,
				values: { name: f.name ?? '', email: f.email ?? '' }
			});
		await audit(
			locals.db,
			me.id,
			'tutor_added',
			r.userId,
			`${(f.name ?? '').trim()} · ${(f.email ?? '').trim()}`
		);
		// shown once to the owner, to pass on to the tutor; never stored in plain text
		return { added: { name: (f.name ?? '').trim(), email: (f.email ?? '').trim(), password } };
	},
	resetStudent: async ({ locals, url, request }) => {
		const me = requireOwner(locals.user, url);
		const f = formObject(await request.formData());
		if (!(f.email ?? '').trim()) return fail(400, { resetError: 'err_required' });
		const email = emailField.safeParse(f.email ?? '');
		if (!email.success) return fail(400, { resetError: 'err_email' });
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
	},
	resetTest: async ({ locals, url, request }) => {
		const me = requireOwner(locals.user, url);
		// only ever on the test site
		if (TEST_SITE !== '1') return fail(404, { error: 'err_not_found' });
		if (formObject(await request.formData()).sure !== 'on')
			return fail(400, { error: 'err_tick_sure' });
		await seedTestData(locals.db, locals.auth, { testSite: true, password: TEST_PASSWORD });
		await audit(locals.db, me.id, 'test_site_reset', null);
		doneRedirect(url, 'owner_done_reset');
	}
};
