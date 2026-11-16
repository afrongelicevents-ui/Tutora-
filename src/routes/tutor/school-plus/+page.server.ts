import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireTutor } from '#lib/server/guards.ts';
import {
	details,
	endPartnership,
	forTutor,
	inviteTeacher,
	PartnershipFail,
	postMessage,
	savePlan,
	saveReport,
	tutorDecide,
	type Partnership
} from '#lib/server/partnership.ts';
import { emailInvite, tellSchoolPlus } from '#lib/server/school-plus-notify.ts';
import { getSettings } from '#lib/server/settings.ts';
import { formObject } from '#lib/validation/auth.ts';
import { ORIGIN } from '$app/env/private';
import { shortName } from '#lib/names.ts';

/** The tutor's School+ partnerships: agree, invite the teacher, then work together. */
export const load: PageServerLoad = async ({ locals, url }) => {
	const me = requireTutor(locals.user, url);
	const rows = await forTutor(locals.db, me.id);
	// full details only for the ones still going (the others show their status)
	const open = new Set(['tutor_accepted', 'teacher_invited', 'teacher_accepted', 'active']);
	return {
		items: await Promise.all(
			rows.map(async (r) => {
				const d = open.has(r.p.status) ? await details(locals.db, r.p) : null;
				return {
					id: r.p.id,
					child: shortName(r.child),
					subject: r.p.subject,
					school: r.p.schoolName,
					teacher: r.teacher ?? r.p.teacherName,
					teacherHasAccount: !!r.p.teacherId,
					teacherEmail: r.p.teacherEmail,
					status: r.p.status,
					since: r.p.activeAt,
					steps: d?.steps ?? null,
					log: d?.log ?? [],
					plan: d?.plan ?? null,
					reports: d?.reports ?? []
				};
			})
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
const idOf = (f: Record<string, string>) => Number(f.id) || 0;

export const actions: Actions = {
	decide: async ({ locals, url, request }) => {
		const me = requireTutor(locals.user, url);
		const f = formObject(await request.formData());
		return handle(async () => {
			const accept = f.accept === '1';
			// declining can't be undone: the "I'm sure" box is checked here too (works without JS)
			if (!accept && f.sure !== 'on') return fail(400, { error: 'err_tick_sure', id: idOf(f) });
			const p = await tutorDecide(locals.db, me.id, idOf(f), accept);
			await tellSchoolPlus(locals.db, p, accept ? 'tutor_accepted' : 'tutor_declined', me.id);
			return { id: p.id, done: accept ? 'accepted' : 'declined' };
		});
	},
	/** A fresh private invite link for the teacher (also emailed when possible). */
	invite: async ({ locals, url, request }) => {
		const me = requireTutor(locals.user, url);
		const f = formObject(await request.formData());
		return handle(async () => {
			const { token, p } = await inviteTeacher(locals.db, me.id, idOf(f));
			const link = `${(ORIGIN || url.origin).replace(/\/$/, '')}/school/${token}`;
			const s = await getSettings(locals.db, me.id);
			const emailed = await emailInvite(p, link, s.tutorName ?? '');
			await tellSchoolPlus(locals.db, p, 'teacher_invited', me.id);
			return { id: p.id, link, emailed };
		});
	},
	message: async ({ locals, url, request }) => {
		const me = requireTutor(locals.user, url);
		const f = formObject(await request.formData());
		return handle(async () => {
			const p = await postMessage(
				locals.db,
				{ role: 'tutor', userId: me.id },
				idOf(f),
				f.body ?? ''
			);
			await tellSchoolPlus(locals.db, p, 'message', me.id);
			return { id: p.id, done: 'sent' };
		});
	},
	plan: async ({ locals, url, request }) => {
		const me = requireTutor(locals.user, url);
		const f = formObject(await request.formData());
		return handle(async () => {
			const p = await savePlan(locals.db, { role: 'tutor', userId: me.id }, idOf(f), f);
			await tellSchoolPlus(locals.db, p, 'plan', me.id);
			return { id: p.id, done: 'plan' };
		});
	},
	report: async ({ locals, url, request }) => {
		const me = requireTutor(locals.user, url);
		const f = formObject(await request.formData());
		return handle(async () => {
			const p = await saveReport(
				locals.db,
				{ role: 'tutor', userId: me.id },
				idOf(f),
				f.body ?? ''
			);
			await tellSchoolPlus(locals.db, p, 'report', me.id);
			return { id: p.id, done: 'report' };
		});
	},
	end: async ({ locals, url, request }) => {
		const me = requireTutor(locals.user, url);
		const f = formObject(await request.formData());
		if (f.sure !== 'on') return fail(400, { error: 'err_tick_sure', id: idOf(f) });
		return handle(async () => {
			const p: Partnership = await endPartnership(
				locals.db,
				{ role: 'tutor', userId: me.id },
				idOf(f)
			);
			await tellSchoolPlus(locals.db, p, 'ended', me.id);
			return { id: p.id, done: 'ended' };
		});
	}
};
