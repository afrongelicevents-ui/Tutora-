import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireTutor } from '#lib/server/guards.ts';
import {
	forTutor,
	logOf,
	PartnershipFail,
	postMessage,
	tutorDecide
} from '#lib/server/partnership.ts';
import { notifyUser } from '#lib/server/notify.ts';
import { formObject } from '#lib/validation/auth.ts';
import { toolsEnv } from '#lib/server/tools/env.ts';
import { shortName } from '#lib/names.ts';
import { m } from '#lib/paraglide/messages.js';

export const load: PageServerLoad = async ({ locals, url }) => {
	const me = requireTutor(locals.user, url);
	const rows = await forTutor(locals.db, me.id);
	return {
		items: await Promise.all(
			rows.map(async (r) => ({
				id: r.p.id,
				child: shortName(r.child),
				subject: r.p.subject,
				school: r.p.schoolName,
				teacher: r.p.teacherName,
				teacherEmail: r.p.teacherEmail,
				status: r.p.status,
				log:
					r.p.status === 'active' || r.p.status === 'school_invited'
						? await logOf(locals.db, r.p.id)
						: []
			}))
		)
	};
};

const handle = async <T>(fn: () => Promise<T>) => {
	try {
		return await fn();
	} catch (e) {
		if (e instanceof PartnershipFail) return fail(400, { error: e.code });
		throw e;
	}
};

export const actions: Actions = {
	decide: async ({ locals, url, request }) => {
		const me = requireTutor(locals.user, url);
		const f = formObject(await request.formData());
		const id = Number(f.id) || 0;
		return handle(async () => {
			const { token, parentId, subject, tutor } = await tutorDecide(
				locals.db,
				me.id,
				id,
				f.accept === '1'
			);
			if (parentId)
				await notifyUser(
					locals.db,
					parentId,
					token ? m.ev_sp_yes_s({ tutor }) : m.ev_sp_no_s({ tutor }),
					token ? m.ev_sp_yes_b({ tutor, subject }) : m.ev_sp_no_b({ tutor, subject }),
					{ kind: 'family', link: `/parent/school-plus/${id}` }
				);
			const origin = toolsEnv(url).origin;
			return { id, link: token ? `${origin}/school/${token}` : null, declined: !token };
		});
	},
	message: async ({ locals, url, request }) => {
		const me = requireTutor(locals.user, url);
		const f = formObject(await request.formData());
		return handle(async () => {
			const p = await postMessage(
				locals.db,
				{ role: 'tutor', tutorId: me.id, id: Number(f.id) || 0 },
				f.body ?? ''
			);
			await notifyUser(
				locals.db,
				p.parentId,
				m.sp3_n_message_s(),
				m.sp3_n_message_b({ subject: p.subject }),
				{
					kind: 'family',
					link: `/parent/school-plus/${p.id}`
				}
			);
			return { sent: true };
		});
	}
};
