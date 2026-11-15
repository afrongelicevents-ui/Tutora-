import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import {
	answeredByToken,
	byToken,
	PartnershipFail,
	teacherRespond
} from '#lib/server/partnership.ts';
import { tellSchoolPlus } from '#lib/server/school-plus-notify.ts';
import { partnership } from '#lib/server/db/v3.schema.ts';
import { profile } from '#lib/server/db/app.schema.ts';
import { user } from '#lib/server/db/auth.schema.ts';
import { tutorProfile } from '#lib/server/db/app.schema.ts';
import { clientIp, hitLimit } from '#lib/server/rate-limit.ts';
import { looksLikeBot } from '#lib/server/bot.ts';
import { emailEnabled } from '#lib/server/auth.ts';
import { endLogin } from '#lib/server/auth-cookies.ts';
import { fieldErrors, formObject, newEmailField, passwordField } from '#lib/validation/auth.ts';
import { shortName } from '#lib/names.ts';
import { APIError } from 'better-auth/api';

/**
 * A schoolteacher's invite to one School+ partnership (private link from the tutor).
 * They make a small schoolteacher account (or log in), then accept or decline.
 */
export const load: PageServerLoad = async ({ locals, params, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store', 'referrer-policy': 'same-origin' });
	const p = await byToken(locals.db, params.token);
	if (!p) {
		// already answered (declined, accepted…): a kind page, not "not found"
		const a = await answeredByToken(locals.db, params.token);
		if (!a) error(404, 'Not found');
		return {
			answered: a.status === 'declined' && a.declinedBy === 'teacher' ? 'declined' : 'done',
			invite: null,
			me: locals.user ? { role: locals.user.role, name: locals.user.name } : null
		};
	}
	const [[kid], [t]] = await Promise.all([
		locals.db.select({ name: user.name }).from(user).where(eq(user.id, p.studentId)),
		locals.db
			.select({ name: tutorProfile.tutorName })
			.from(tutorProfile)
			.where(eq(tutorProfile.tutorId, p.tutorId))
	]);
	return {
		answered: null,
		invite: {
			child: shortName(kid?.name ?? ''),
			subject: p.subject,
			school: p.schoolName,
			teacher: p.teacherName,
			tutor: t?.name ?? '',
			/** an older partnership that started before teacher accounts existed */
			legacy: p.status === 'active'
		},
		me: locals.user ? { role: locals.user.role, name: locals.user.name } : null
	};
};

const signupSchema = z.object({
	name: z.string().trim().min(2, 'err_name').max(80, 'err_too_long'),
	email: newEmailField,
	password: passwordField,
	school: z.string().trim().min(2, 'err_required').max(120, 'err_too_long')
});

export const actions: Actions = {
	/** A new schoolteacher account (only through an invite), signed in right away. */
	signup: async ({ locals, params, request, cookies }) => {
		const p = await byToken(locals.db, params.token);
		if (!p) error(404, 'Not found');
		const input = formObject(await request.formData());
		const values = { ...input, password: '' };
		if (looksLikeBot(input)) return fail(400, { values, errors: { form: 'err_try_again' } });
		const limit = await hitLimit(locals.db, 'signup', clientIp(request));
		if (!limit.ok) return fail(429, { values, errors: { form: 'err_rate_limited' } });
		const v = signupSchema.safeParse(input);
		if (!v.success) return fail(400, { values, errors: fieldErrors(v.error) });
		let userId: string;
		try {
			const res = await locals.auth.api.signUpEmail({
				body: {
					name: v.data.name,
					email: v.data.email,
					password: v.data.password,
					callbackURL: `/school/${params.token}`
				}
			});
			userId = res.user.id;
		} catch (e) {
			if (e instanceof APIError) return fail(400, { values, errors: { email: 'err_email_taken' } });
			throw e;
		}
		// an address that already has an account: Better Auth answers alike without making one
		const [made] = await locals.db
			.select({ role: user.role })
			.from(user)
			.where(eq(user.id, userId));
		if (!made) return fail(400, { values, errors: { email: 'spi_err_has_account' } });
		if (made.role === 'student')
			await locals.db.update(user).set({ role: 'schoolteacher' }).where(eq(user.id, userId));
		await locals.db.insert(profile).values({ userId, consentAt: new Date() }).onConflictDoNothing();
		// the school as the teacher wrote it
		await locals.db
			.update(partnership)
			.set({ schoolName: v.data.school })
			.where(eq(partnership.id, p.id));
		if (emailEnabled)
			redirect(
				303,
				`/verify-email?email=${encodeURIComponent(v.data.email)}&next=${encodeURIComponent(`/school/${params.token}`)}`
			);
		await endLogin(locals.db, cookies, userId);
		await locals.auth.api
			.signInEmail({ body: { email: v.data.email, password: v.data.password } })
			.catch(() => {});
		redirect(303, `/school/${params.token}`);
	},
	respond: async ({ locals, params, request }) => {
		const me = locals.user;
		if (!me) redirect(303, `/login?next=${encodeURIComponent(`/school/${params.token}`)}`);
		const f = formObject(await request.formData());
		const accept = f.accept === '1';
		try {
			const p = await teacherRespond(locals.db, params.token, me.id, accept);
			await tellSchoolPlus(
				locals.db,
				p,
				p.status === 'declined' ? 'teacher_declined' : 'teacher_accepted',
				me.id
			);
			if (p.status === 'declined') return { declined: true };
			redirect(303, `/teacher/p/${p.id}?welcome=1`);
		} catch (e) {
			if (e instanceof PartnershipFail) return fail(400, { error: e.code });
			throw e;
		}
	}
};
