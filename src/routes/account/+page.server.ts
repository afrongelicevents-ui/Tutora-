import { redirect } from '@sveltejs/kit';
import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { profile } from '#lib/server/db/app.schema.ts';
import { user as userTable } from '#lib/server/db/auth.schema.ts';
import { getPrefs, setPrefs } from '#lib/server/notify.ts';
import { deleteMyAccount } from '#lib/server/student.ts';
import { endLogin } from '#lib/server/auth-cookies.ts';
import { clientIp, hitLimit } from '#lib/server/rate-limit.ts';
import { emailEnabled } from '#lib/server/auth.ts';
import { changeEmailNow } from '#lib/server/account.ts';
import { notifyUser } from '#lib/server/notify.ts';
import { m } from '#lib/paraglide/messages.js';
import { APIError } from 'better-auth/api';
import { fieldErrors, formObject, newEmailField, phone } from '#lib/validation/auth.ts';
import { requireUser } from '#lib/server/guards.ts';
import { homeFor } from '#lib/roles.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = requireUser(locals.user, url);
	// After logging in, send each person to their own area: tutor dashboard, student area or
	// owner admin. Tutors waiting for approval see their status; tutors and the owner switch on
	// the authenticator app first.
	if (url.searchParams.has('welcome')) {
		if (user.role === 'tutor' && user.tutorStatus === 'suspended') redirect(303, '/tutor-status');
		if ((user.role === 'tutor' || user.role === 'owner') && !user.twoFactorEnabled)
			redirect(303, '/account/2fa?required=1');
		redirect(303, homeFor(user.role));
	}
	const [prof] = await locals.db
		.select({ phone: profile.phone })
		.from(profile)
		.where(eq(profile.userId, user.id));
	return {
		account: {
			name: user.name,
			email: user.email,
			role: user.role,
			twoFactorEnabled: user.twoFactorEnabled,
			phone: prof?.phone ?? null,
			// younger children sign in with a username: their parent manages that login
			canChangeEmail: !user.email.endsWith('.invalid')
		},
		emailOn: emailEnabled,
		changed: url.searchParams.has('changed'),
		prefs: await getPrefs(locals.db, user.id)
	};
};

const detailsSchema = z.object({
	name: z.string().trim().min(2, 'err_name').max(80, 'err_too_long'),
	phone: z.union([phone, z.literal('')]).optional()
});

export const actions: Actions = {
	details: async ({ locals, url, request }) => {
		const u = requireUser(locals.user, url);
		const p = detailsSchema.safeParse(formObject(await request.formData()));
		if (!p.success) return fail(400, { errors: fieldErrors(p.error) });
		await locals.db.update(userTable).set({ name: p.data.name }).where(eq(userTable.id, u.id));
		if (u.role === 'student' || u.role === 'parent')
			await locals.db
				.update(profile)
				.set({ phone: p.data.phone || null })
				.where(eq(profile.userId, u.id));
		return { saved: 'details' };
	},
	/** Change the login email (any role). With an email service, a confirmation link goes to
	 *  the new address and the change happens when it's opened; without one, the current
	 *  password proves it's you. */
	email: async ({ locals, url, request }) => {
		const u = requireUser(locals.user, url);
		if (u.email.endsWith('.invalid')) return fail(403, { errors: { newEmail: 'err_generic' } });
		const limit = await hitLimit(locals.db, 'passwordReset', `${clientIp(request)}:${u.id}:email`);
		if (!limit.ok) return fail(429, { errors: { newEmail: 'err_rate_limited' } });
		const parsed = z
			.object({ newEmail: newEmailField, password: z.string().max(128).optional() })
			.safeParse(formObject(await request.formData()));
		if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error) });
		if (parsed.data.newEmail.toLowerCase() === u.email.toLowerCase())
			return fail(400, { errors: { newEmail: 'err_email_same' } });
		// always prove it's you: a phone left logged in must not be enough to move the login
		const okPw = await locals.auth.api
			.verifyPassword({
				body: { password: parsed.data.password ?? '' },
				headers: request.headers
			})
			.then(() => true)
			.catch(() => false);
		if (!okPw) return fail(400, { errors: { password: 'err_password_wrong' } });
		// tell the current address (in-app, and by email when that is on)
		await notifyUser(
			locals.db,
			u.id,
			m.acc_email_alert_s(),
			m.acc_email_alert_b({ email: parsed.data.newEmail }),
			{ kind: 'account', link: '/account' }
		);
		if (!emailEnabled) {
			const r = await changeEmailNow(locals.db, u.id, parsed.data.newEmail);
			if (r === 'same') return fail(400, { errors: { newEmail: 'err_email_same' } });
			if (r === 'taken') return fail(400, { errors: { newEmail: 'err_email_taken' } });
			return { emailChanged: parsed.data.newEmail };
		}
		try {
			await locals.auth.api.changeEmail({
				body: { newEmail: parsed.data.newEmail, callbackURL: '/account?changed=1' },
				headers: request.headers
			});
		} catch (e) {
			if (e instanceof APIError) return fail(400, { errors: { newEmail: 'err_email_taken' } });
			throw e;
		}
		return { emailSent: parsed.data.newEmail };
	},
	prefs: async ({ locals, url, request }) => {
		const u = requireUser(locals.user, url);
		const f = formObject(await request.formData());
		// unticked = "don't tell me"
		await setPrefs(locals.db, u.id, {
			emailOff: f.email !== 'on',
			remindersOff: f.reminders !== 'on',
			homeworkOff: f.homework !== 'on'
		});
		return { saved: 'prefs' };
	},
	delete: async ({ locals, url, request, cookies }) => {
		const u = requireUser(locals.user, url);
		// the platform owner's account is not deleted from here
		if (u.role === 'owner') return fail(403, { deleteError: 'err_generic' });
		const f = formObject(await request.formData());
		if (f.confirm !== 'DELETE') return fail(400, { deleteError: 'err_delete_confirm' });
		const limit = await hitLimit(locals.db, 'passwordReset', `delete:${u.id}`);
		if (!limit.ok) return fail(429, { deleteError: 'err_rate_limited' });
		const ok = await locals.auth.api
			.verifyPassword({ body: { password: f.password ?? '' }, headers: request.headers })
			.then(() => true)
			.catch(() => false);
		if (!ok) return fail(400, { deleteError: 'err_password_wrong' });
		await deleteMyAccount(locals.db, u.id);
		await endLogin(locals.db, cookies, u.id);
		redirect(303, '/?deleted=1');
	}
};
