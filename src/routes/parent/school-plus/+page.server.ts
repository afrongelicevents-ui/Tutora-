import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { FamilyFail, parentAccess } from '#lib/server/family.ts';
import { pickChild } from '#lib/server/parent-child.ts';
import { childPhotos } from '#lib/server/parent-home.ts';
import {
	PartnershipFail,
	requestPartnership,
	schoolPlusForChild
} from '#lib/server/partnership.ts';
import { tellSchoolPlus } from '#lib/server/school-plus-notify.ts';
import { formObject } from '#lib/validation/auth.ts';

/** School+ for one child at a time (?child=): offer and request, the steps, or the active team. */
export const load: PageServerLoad = async ({ locals, url, cookies }) => {
	const u = requireRole(locals.user, url, ['parent']);
	const { kids, current } = await pickChild(locals.db, u.id, url, cookies);
	if (!current) return { kids, current: null, sp: null, child: null };
	const [sp, photos] = await Promise.all([
		schoolPlusForChild(locals.db, u.id, current),
		childPhotos(locals.db, [current])
	]);
	const kid = kids.find((k) => k.id === current);
	return {
		kids,
		current,
		sp,
		child: {
			id: current,
			name: kid?.name ?? '',
			level: kid?.level ?? null,
			photo: photos.get(current) ?? null
		}
	};
};

export const actions: Actions = {
	request: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['parent']);
		const f = formObject(await request.formData());
		if (!(await parentAccess(locals.db, u.id, f.child ?? '')).ok)
			return fail(400, { error: 'err_not_found', values: f });
		try {
			const row = await requestPartnership(locals.db, u.id, {
				studentId: f.child ?? '',
				tutorId: f.tutor ?? '',
				subject: f.subject ?? '',
				schoolName: f.school ?? '',
				teacherName: f.teacher ?? '',
				teacherEmail: f.teacherEmail
			});
			await tellSchoolPlus(locals.db, row, 'requested', u.id);
			redirect(303, `/parent/school-plus/${row.id}`);
		} catch (e) {
			if (e instanceof PartnershipFail || e instanceof FamilyFail)
				return fail(400, { error: e.code, values: f });
			throw e;
		}
	}
};
