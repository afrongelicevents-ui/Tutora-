import { fail, redirect } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { childrenOf, FamilyFail, parentAccess } from '#lib/server/family.ts';
import { forParent, PartnershipFail, requestPartnership } from '#lib/server/partnership.ts';
import { enrollment, tutorProfile } from '#lib/server/db/app.schema.ts';
import { notifyTutor } from '#lib/server/notify.ts';
import { formObject } from '#lib/validation/auth.ts';
import { shortName } from '#lib/names.ts';
import { m } from '#lib/paraglide/messages.js';

export const load: PageServerLoad = async ({ locals, url }) => {
	const u = requireRole(locals.user, url, ['parent']);
	const kids = (await childrenOf(locals.db, u.id)).filter((k) => k.status === 'active');
	const tutors = await Promise.all(
		kids.map(async (k) => ({
			childId: k.studentId,
			list: await locals.db
				.select({ id: tutorProfile.tutorId, name: tutorProfile.tutorName })
				.from(enrollment)
				.innerJoin(tutorProfile, eq(tutorProfile.tutorId, enrollment.tutorId))
				.where(and(eq(enrollment.userId, k.studentId), eq(tutorProfile.status, 'active')))
		}))
	);
	const mine = await forParent(locals.db, u.id);
	return {
		kids: kids.map((k) => ({
			id: k.studentId,
			name: shortName(k.name),
			canConsent: !k.isUnder18 || k.guardian
		})),
		tutors,
		partnerships: mine.map((r) => ({
			id: r.p.id,
			child: shortName(r.child),
			tutor: r.tutor,
			subject: r.p.subject,
			school: r.p.schoolName,
			teacher: r.p.teacherName,
			status: r.p.status
		}))
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
				teacherEmail: f.teacherEmail,
				consentName: f.consentName ?? '',
				consent: f.consent === 'on'
			});
			await notifyTutor(
				locals.db,
				row.tutorId,
				m.sp3_n_request_s(),
				m.sp3_n_request_b({ subject: row.subject, school: row.schoolName }),
				{ kind: 'family', link: '/tutor/school-plus' }
			);
			redirect(303, `/parent/school-plus/${row.id}`);
		} catch (e) {
			if (e instanceof PartnershipFail || e instanceof FamilyFail)
				return fail(400, { error: e.code, values: f });
			throw e;
		}
	}
};
