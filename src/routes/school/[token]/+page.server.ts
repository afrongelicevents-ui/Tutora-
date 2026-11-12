import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	byToken,
	logOf,
	PartnershipFail,
	postMessage,
	schoolRespond
} from '#lib/server/partnership.ts';
import { notifyTutor, notifyUser } from '#lib/server/notify.ts';
import { clientIp, hitLimit } from '#lib/server/rate-limit.ts';
import { formObject } from '#lib/validation/auth.ts';
import { m } from '#lib/paraglide/messages.js';
import { eq } from 'drizzle-orm';
import { user } from '#lib/server/db/auth.schema.ts';
import { shortName } from '#lib/names.ts';

/** The schoolteacher's private page (no account needed): opt in or not, then logged messages. */
export const load: PageServerLoad = async ({ locals, params, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer' });
	const p = await byToken(locals.db, params.token);
	if (!p) error(404, 'Not found');
	const [kid] = await locals.db
		.select({ name: user.name })
		.from(user)
		.where(eq(user.id, p.studentId));
	return {
		p: {
			subject: p.subject,
			school: p.schoolName,
			teacher: p.teacherName,
			status: p.status,
			consentText: p.consentText,
			child: shortName(kid?.name ?? '')
		},
		log: p.status === 'active' ? await logOf(locals.db, p.id) : []
	};
};

export const actions: Actions = {
	respond: async ({ locals, params, request }) => {
		const limit = await hitLimit(locals.db, 'familyCode', clientIp(request));
		if (!limit.ok) return fail(429, { error: 'err_rate_limited' });
		const f = formObject(await request.formData());
		const p = await byToken(locals.db, params.token);
		if (!p) error(404, 'Not found');
		try {
			await schoolRespond(locals.db, params.token, f.accept === '1', f.teacher ?? '');
		} catch (e) {
			if (e instanceof PartnershipFail) return fail(400, { error: e.code });
			throw e;
		}
		const s = f.accept === '1' ? m.sp3_n_school_yes_s() : m.sp3_n_school_no_s();
		await notifyUser(locals.db, p.parentId, s, m.sp3_n_school_b({ school: p.schoolName }), {
			kind: 'family',
			link: `/parent/school-plus/${p.id}`
		});
		await notifyTutor(locals.db, p.tutorId, s, m.sp3_n_school_b({ school: p.schoolName }), {
			kind: 'family',
			link: '/tutor/school-plus'
		});
		return { responded: true };
	},
	message: async ({ locals, params, request }) => {
		const limit = await hitLimit(locals.db, 'familyCode', clientIp(request));
		if (!limit.ok) return fail(429, { error: 'err_rate_limited' });
		const f = formObject(await request.formData());
		try {
			const p = await postMessage(
				locals.db,
				{ role: 'teacher', token: params.token },
				f.body ?? ''
			);
			await notifyTutor(
				locals.db,
				p.tutorId,
				m.sp3_n_message_s(),
				m.sp3_n_message_b({ subject: p.subject }),
				{ kind: 'family', link: '/tutor/school-plus' }
			);
			await notifyUser(
				locals.db,
				p.parentId,
				m.sp3_n_message_s(),
				m.sp3_n_message_b({ subject: p.subject }),
				{ kind: 'family', link: `/parent/school-plus/${p.id}` }
			);
		} catch (e) {
			if (e instanceof PartnershipFail) return fail(400, { error: e.code });
			throw e;
		}
		return { sent: true };
	}
};
