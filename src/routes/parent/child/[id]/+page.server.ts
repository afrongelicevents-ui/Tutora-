import { error, fail } from '@sveltejs/kit';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { parentAccess, childrenOf } from '#lib/server/family.ts';
import { requireRole } from '#lib/server/guards.ts';
import { childOverview } from '#lib/server/parent.ts';
import { childPhotos } from '#lib/server/parent-home.ts';
import { readingParents } from '#lib/server/messages.ts';
import { tutorsForUser } from '#lib/server/people.ts';
import { shareReport } from '#lib/server/planner.ts';
import { homework, homeworkAnswer } from '#lib/server/db/app.schema.ts';
import { openPartnershipOf } from '#lib/server/partnership.ts';
import {
	BookingFail,
	bookingTutorId,
	requestsForUser,
	respondToProposal
} from '#lib/server/bookings.ts';
import { afterAccept } from '#lib/server/after-accept.ts';
import { toolsEnv } from '#lib/server/tools/env.ts';
import { notifyTutor } from '#lib/server/notify.ts';
import { formObject } from '#lib/validation/auth.ts';
import { m } from '#lib/paraglide/messages.js';

/** One child, as their parent may see them (only what the child shares). */
export const load: PageServerLoad = async ({ locals, url, params }) => {
	const u = requireRole(locals.user, url, ['parent']);
	const id = params.id;
	const access = await parentAccess(locals.db, u.id, id);
	if (!access.ok) error(404, 'Not found');
	const kid = (await childrenOf(locals.db, u.id)).find((k) => k.studentId === id);
	const [child, photos, readers, tutors, sharesReport, sp] = await Promise.all([
		childOverview(locals.db, u.id, id),
		childPhotos(locals.db, [id]),
		readingParents(locals.db, id),
		tutorsForUser(locals.db, id),
		shareReport(locals.db, id),
		// the child's School+ partnership still going, if any (same batch, one small query)
		openPartnershipOf(locals.db, u.id, id)
	]);
	const requests = access.guardian ? await requestsForUser(locals.db, id) : [];
	const hw: { id: number; title: string; dueOn: string | null; subject: string | null }[] =
		access.homework
			? await locals.db
					.select({
						id: homework.id,
						title: homework.title,
						dueOn: homework.dueOn,
						subject: homework.subject
					})
					.from(homework)
					.leftJoin(homeworkAnswer, eq(homeworkAnswer.homeworkId, homework.id))
					.where(and(eq(homework.userId, id), isNull(homeworkAnswer.id)))
					.orderBy(asc(homework.dueOn), desc(homework.id))
					.limit(6)
			: [];
	if (!child) error(404, 'Not found');
	return {
		child,
		level: kid?.level ?? null,
		guardian: access.guardian,
		photo: photos.get(id) ?? null,
		readsMessages: readers.includes(u.id),
		tutors: tutors
			.filter((t) => t.status === 'active')
			.map((t) => ({ slug: t.slug, name: t.name })),
		sharesReport,
		schoolPlus: sp ?? null,
		homework: hw,
		booked: url.searchParams.has('booked'),
		requests: requests.map((r) => ({
			id: r.id,
			status: r.status,
			startsAt: r.startsAt,
			proposedStartsAt: r.proposedStartsAt,
			tutorMessage: r.tutorMessage,
			subjectName: r.subjectName,
			tutorName: r.tutorName,
			tutorSlug: r.tutorSlug
		}))
	};
};

export const actions: Actions = {
	/** A guardian accepts or declines the tutor's suggested time for their child. */
	respond: async ({ locals, url, request, params }) => {
		const u = requireRole(locals.user, url, ['parent']);
		const child = params.id;
		const f = formObject(await request.formData());
		const access = await parentAccess(locals.db, u.id, child);
		if (!access.ok || !access.guardian) return fail(404, { error: 'err_not_found' });
		const id = Number(f.id) || 0;
		const yes = f.answer === 'yes';
		const tutorId = await bookingTutorId(locals.db, child, id);
		let accepted: Awaited<ReturnType<typeof respondToProposal>>;
		try {
			accepted = await respondToProposal(locals.db, child, id, yes);
		} catch (e) {
			if (e instanceof BookingFail) return fail(400, { error: e.code });
			throw e;
		}
		if (accepted) await afterAccept(locals.db, toolsEnv(url), accepted);
		if (tutorId)
			await notifyTutor(
				locals.db,
				tutorId,
				yes ? m.email_time_accepted_s() : m.email_time_declined_s(),
				yes ? m.email_time_accepted_b({ name: u.name }) : m.email_time_declined_b({ name: u.name }),
				{ kind: 'booking', link: '/tutor#requests' }
			);
		return { responded: yes ? 'yes' : 'no' };
	}
};
