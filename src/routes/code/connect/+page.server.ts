import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { FamilyFail, previewInvite, redeemInvite } from '#lib/server/family.ts';
import { forgetCode, rememberedCode } from '#lib/server/family-code.ts';
import { signUp } from '#lib/server/actions/signup.ts';
import { clientIp, hitLimit } from '#lib/server/rate-limit.ts';
import { formObject } from '#lib/validation/auth.ts';
import { looksLikeBot } from '#lib/server/bot.ts';
import { emailEnabled } from '#lib/server/auth.ts';
import { endLogin } from '#lib/server/auth-cookies.ts';
import { notifyUser } from '#lib/server/notify.ts';
import { m } from '#lib/i18n.ts';
import type { DB } from '#lib/server/db/types.ts';
import { eq } from 'drizzle-orm';
import { user } from '#lib/server/db/auth.schema.ts';

async function current(db: DB, code: string | null) {
	if (!code) return null;
	return previewInvite(db, code);
}

export const load: PageServerLoad = async ({ locals, cookies, url }) => {
	const invite = await current(locals.db, rememberedCode(cookies));
	if (!invite) {
		forgetCode(cookies);
		redirect(303, '/code');
	}
	return {
		invite: { firstName: invite.firstName, level: invite.level, isUnder18: invite.isUnder18 },
		me: locals.user ? { role: locals.user.role, name: locals.user.name } : null,
		create: url.searchParams.has('create')
	};
};

/** Connect the signed-in parent, tell the child (and the guardian when approval is needed). */
async function connect(
	db: DB,
	code: string,
	parent: { id: string; name: string },
	guardianClaim: boolean
) {
	const r = await redeemInvite(db, code, parent.id, { guardianClaim });
	await notifyUser(
		db,
		r.studentId,
		m.fam_notify_joined_s({ name: parent.name }),
		m.fam_notify_joined_b({ name: parent.name }),
		{ kind: 'family', link: '/student/family' }
	);
	if (r.status === 'pending_guardian' && r.guardianId) {
		const [kid] = await db.select({ name: user.name }).from(user).where(eq(user.id, r.studentId));
		const child = (kid?.name ?? '').split(/\s+/)[0];
		await notifyUser(
			db,
			r.guardianId,
			m.fam_notify_pending_s({ name: parent.name, child }),
			m.fam_notify_pending_b({ child }),
			{ kind: 'family', link: '/parent/children' }
		);
	}
	return r;
}

export const actions: Actions = {
	/** Already signed in as a parent: connect now. */
	connect: async ({ request, locals, cookies }) => {
		const code = rememberedCode(cookies);
		if (!locals.user) redirect(303, '/login?next=/code/connect');
		if (!code) redirect(303, '/code');
		const invite = await previewInvite(locals.db, code);
		const fd = await request.formData();
		try {
			const r = await connect(
				locals.db,
				code,
				{ id: locals.user.id, name: locals.user.name },
				fd.get('guardian') === 'on'
			);
			forgetCode(cookies);
			redirect(
				303,
				`/parent?${r.status === 'active' ? 'connected' : 'pending'}=${encodeURIComponent(invite?.firstName ?? '')}`
			);
		} catch (e) {
			if (e instanceof FamilyFail) return fail(400, { error: e.code });
			throw e;
		}
	},
	/** New parent account, then connect. */
	signup: async ({ request, locals, cookies }) => {
		const code = rememberedCode(cookies);
		if (!code) redirect(303, '/code');
		const input = formObject(await request.formData());
		const values = { ...input, password: '' };
		if (looksLikeBot(input)) return fail(400, { values, errors: { form: 'err_try_again' } });
		const limit = await hitLimit(locals.db, 'signup', clientIp(request));
		if (!limit.ok)
			return fail(429, {
				values,
				errors: { form: 'err_rate_limited' },
				retryMinutes: Math.ceil(limit.retryAfterSeconds / 60)
			});
		const invite = await previewInvite(locals.db, code);
		if (!invite) return fail(400, { values, errors: { form: 'v3_code_bad' } });
		const result = await signUp(
			{ auth: locals.auth, db: locals.db },
			{ ...input, accountType: 'parent', isUnder18: '' },
			'/code/connect'
		);
		if (!result.ok) return fail(400, { values, errors: result.errors });
		// With email confirmation the parent comes back after confirming; the code is remembered.
		if (emailEnabled || !result.userId)
			redirect(303, `/verify-email?email=${encodeURIComponent(result.email)}&next=/code/connect`);
		// No email service: the account is ready. Log in again so the cookie carries the parent role.
		await endLogin(locals.db, cookies, result.userId);
		await locals.auth.api
			.signInEmail({ body: { email: result.email, password: input.password ?? '' } })
			.catch(() => {});
		try {
			const r = await connect(
				locals.db,
				code,
				{ id: result.userId, name: input.name?.trim() ?? '' },
				input.guardian === 'on'
			);
			forgetCode(cookies);
			redirect(
				303,
				`/parent?${r.status === 'active' ? 'connected' : 'pending'}=${encodeURIComponent(invite.firstName)}`
			);
		} catch (e) {
			if (e instanceof FamilyFail) redirect(303, '/parent');
			throw e;
		}
	}
};
