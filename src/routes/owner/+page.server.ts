import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { TEST_PASSWORD, TEST_SITE } from '$app/env/private';
import { requireOwner } from '#lib/server/guards.ts';
import { allTutors, platformCounts, setTutorStatus } from '#lib/server/owner.ts';
import { addTutorByOwner } from '#lib/server/actions/setup.ts';
import { setPasswordFor, studentByEmail, tempPassword } from '#lib/server/account.ts';
import { emailField } from '#lib/validation/auth.ts';
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
		testSite: TEST_SITE === '1'
	};
};

const statusForm = z.object({
	id: z.string().min(1).max(100),
	status: z.enum(['active', 'suspended'])
});

export const actions: Actions = {
	status: async ({ locals, url, request }) => {
		requireOwner(locals.user, url);
		const p = statusForm.safeParse(formObject(await request.formData()));
		if (!p.success) return fail(400, { error: 'err_generic' });
		const ok = await setTutorStatus(locals.db, p.data.id, p.data.status);
		if (!ok) return fail(404, { error: 'err_not_found' });
		return { done: p.data.status === 'active' ? 'owner_done_active' : 'owner_done_suspended' };
	},
	addTutor: async ({ locals, url, request }) => {
		requireOwner(locals.user, url);
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
		// shown once to the owner, to pass on to the tutor; never stored in plain text
		return { added: { name: (f.name ?? '').trim(), email: (f.email ?? '').trim(), password } };
	},
	resetStudent: async ({ locals, url, request }) => {
		requireOwner(locals.user, url);
		const f = formObject(await request.formData());
		const email = emailField.safeParse(f.email ?? '');
		const s = email.success ? await studentByEmail(locals.db, email.data) : null;
		if (!s) return fail(404, { error: 'owner_reset_none' });
		const password = tempPassword();
		if (!(await setPasswordFor({ auth: locals.auth, db: locals.db }, s.id, password)))
			return fail(400, { error: 'owner_reset_none' });
		// tell the account holder (by email, when email is switched on)
		await notifyUser(locals.db, s.id, m.email_pw_reset_s(), m.email_pw_reset_b());
		console.log(`owner ${locals.user!.id} reset the password of ${s.id}`);
		// shown once to the owner; the student must change it at their next login
		return { reset: { name: s.name, password } };
	},
	resetTest: async ({ locals, url }) => {
		requireOwner(locals.user, url);
		// only ever on the test site
		if (TEST_SITE !== '1') return fail(404, { error: 'err_not_found' });
		await seedTestData(locals.db, locals.auth, { testSite: true, password: TEST_PASSWORD });
		return { done: 'owner_done_reset' };
	}
};
