import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import {
	details,
	endPartnership,
	PartnershipFail,
	postMessage,
	savePlan,
	saveReport,
	teacherPartnership
} from '#lib/server/partnership.ts';
import { tellSchoolPlus } from '#lib/server/school-plus-notify.ts';
import { formObject } from '#lib/validation/auth.ts';
import { shortName } from '#lib/names.ts';

/** One partnership, for the teacher who accepted it (anyone else: not found). */
export const load: PageServerLoad = async ({ locals, url, params }) => {
	const me = requireRole(locals.user, url, ['schoolteacher']);
	const p = await teacherPartnership(locals.db, me.id, Number(params.id) || 0);
	if (!p) error(404, 'Not found');
	const d = await details(locals.db, p);
	return {
		welcome: url.searchParams.has('welcome'),
		id: p.id,
		status: p.status,
		subject: p.subject,
		school: p.schoolName,
		child: shortName(d.child),
		tutor: d.tutor,
		since: d.since,
		consentText: p.consentText,
		steps: d.steps,
		log: d.log,
		plan: d.plan,
		reports: d.reports
	};
};

const run = async (
	locals: App.Locals,
	url: URL,
	params: { id: string },
	fn: (who: { role: 'teacher'; userId: string }, id: number) => Promise<unknown>
) => {
	const me = requireRole(locals.user, url, ['schoolteacher']);
	try {
		await fn({ role: 'teacher', userId: me.id }, Number(params.id) || 0);
	} catch (e) {
		if (e instanceof PartnershipFail) return fail(400, { error: e.code });
		throw e;
	}
	return null;
};

export const actions: Actions = {
	message: async ({ locals, url, params, request }) => {
		const f = formObject(await request.formData());
		return (
			(await run(locals, url, params, async (who, id) => {
				const p = await postMessage(locals.db, who, id, f.body ?? '');
				await tellSchoolPlus(locals.db, p, 'message', who.userId);
			})) ?? { done: 'sent' }
		);
	},
	plan: async ({ locals, url, params, request }) => {
		const f = formObject(await request.formData());
		return (
			(await run(locals, url, params, async (who, id) => {
				const p = await savePlan(locals.db, who, id, f);
				await tellSchoolPlus(locals.db, p, 'plan', who.userId);
			})) ?? { done: 'plan' }
		);
	},
	report: async ({ locals, url, params, request }) => {
		const f = formObject(await request.formData());
		return (
			(await run(locals, url, params, async (who, id) => {
				const p = await saveReport(locals.db, who, id, f.body ?? '');
				await tellSchoolPlus(locals.db, p, 'report', who.userId);
			})) ?? { done: 'report' }
		);
	},
	end: async ({ locals, url, params, request }) => {
		const f = formObject(await request.formData());
		if (f.sure !== 'on') return fail(400, { error: 'err_tick_sure' });
		return (
			(await run(locals, url, params, async (who, id) => {
				const p = await endPartnership(locals.db, who, id);
				await tellSchoolPlus(locals.db, p, 'ended', who.userId);
			})) ?? { done: 'ended' }
		);
	}
};
