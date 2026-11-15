import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import {
	details,
	giveConsent,
	parentPartnership,
	PartnershipFail,
	stopPartnership
} from '#lib/server/partnership.ts';
import { tellSchoolPlus } from '#lib/server/school-plus-notify.ts';
import { childrenOf, parentAccess } from '#lib/server/family.ts';
import { childPhotos } from '#lib/server/parent-home.ts';
import { overallProgress } from '#lib/server/progress.ts';
import { formObject } from '#lib/validation/auth.ts';

/** One partnership: its steps, the consent (given once the teacher agreed), plan, notes and log. */
export const load: PageServerLoad = async ({ locals, url, params }) => {
	const u = requireRole(locals.user, url, ['parent']);
	const p = await parentPartnership(locals.db, u.id, Number(params.id) || 0);
	if (!p) error(404, 'Not found');
	const [d, access, photos, kids] = await Promise.all([
		details(locals.db, p),
		parentAccess(locals.db, u.id, p.studentId),
		childPhotos(locals.db, [p.studentId]),
		childrenOf(locals.db, u.id)
	]);
	// the child's progress, only when the child shares it (the same rule as everywhere)
	const progress = access.progress ? await overallProgress(locals.db, p.studentId) : null;
	return {
		...d,
		childId: p.studentId,
		childPhoto: photos.get(p.studentId) ?? null,
		childLevel: kids.find((k) => k.studentId === p.studentId)?.level ?? null,
		progress: progress?.current
			? {
					pct: progress.current.pct,
					change: progress.previous ? progress.current.pct - progress.previous.pct : null
				}
			: null,
		progressShared: access.progress
	};
};

export const actions: Actions = {
	/** The written consent naming the teacher who accepted: School+ starts. */
	consent: async ({ locals, url, params, request }) => {
		const u = requireRole(locals.user, url, ['parent']);
		const f = formObject(await request.formData());
		try {
			const p = await giveConsent(locals.db, u.id, Number(params.id) || 0, {
				consentName: f.consentName ?? '',
				consent: f.consent === 'on'
			});
			await tellSchoolPlus(locals.db, p, 'active', u.id);
		} catch (e) {
			if (e instanceof PartnershipFail) return fail(400, { error: e.code });
			throw e;
		}
		return { consented: true };
	},
	stop: async ({ locals, url, params }) => {
		const u = requireRole(locals.user, url, ['parent']);
		try {
			const p = await stopPartnership(locals.db, u.id, Number(params.id) || 0);
			await tellSchoolPlus(locals.db, p, p.status === 'ended' ? 'ended' : 'withdrawn', u.id);
		} catch (e) {
			if (e instanceof PartnershipFail) return fail(400, { error: e.code });
			throw e;
		}
		return { stopped: true };
	}
};
