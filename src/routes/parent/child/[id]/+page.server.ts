import { error, fail } from '@sveltejs/kit';
import { and, desc, eq, lt, sql } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { parentAccess, childrenOf } from '#lib/server/family.ts';
import { requireRole } from '#lib/server/guards.ts';
import { childOverview } from '#lib/server/parent.ts';
import { childPhotos } from '#lib/server/parent-home.ts';
import { readingParents } from '#lib/server/messages.ts';
import { tutorsForUser } from '#lib/server/people.ts';
import { recommendationsFor } from '#lib/server/recommend.ts';
import { shareReport } from '#lib/server/planner.ts';
import { attendee, homework, lesson, subject, tutorProfile } from '#lib/server/db/app.schema.ts';
import { openPartnershipOf } from '#lib/server/partnership.ts';
import {
	BookingFail,
	bookingTutorId,
	requestsForUser,
	respondToProposal
} from '#lib/server/bookings.ts';
import { handedInLate } from '#lib/server/homework-status.ts';
import { sentReportsFor, tutorNames } from '#lib/server/reports.ts';
import { afterAccept } from '#lib/server/after-accept.ts';
import { childCovered } from '#lib/server/family-billing.ts';
import { FAMILY_FEATURES } from '#lib/family-features.ts';
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
	const [child, photos, readers, tutors, sharesReport, sp, past] = await Promise.all([
		childOverview(locals.db, u.id, id),
		childPhotos(locals.db, [id]),
		readingParents(locals.db, id),
		tutorsForUser(locals.db, id),
		shareReport(locals.db, id),
		// the child's School+ partnership still going, if any (same batch, one small query)
		openPartnershipOf(locals.db, u.id, id),
		// the last lessons and whether they happened (the tutor marks attendance), only when the
		// child shares their lessons
		(access.lessons
			? locals.db
					.select({
						id: lesson.id,
						startsAt: lesson.startsAt,
						subjectName: subject.name,
						tutorName: tutorProfile.tutorName,
						tutorSlug: tutorProfile.slug,
						attendance: attendee.attendance
					})
					.from(attendee)
					.innerJoin(lesson, eq(lesson.id, attendee.lessonId))
					.leftJoin(subject, eq(subject.id, lesson.subjectId))
					.leftJoin(tutorProfile, eq(tutorProfile.tutorId, lesson.tutorId))
					.where(
						and(
							eq(attendee.userId, id),
							eq(attendee.status, 'booked'),
							eq(lesson.status, 'scheduled'),
							lt(lesson.endsAt, new Date())
						)
					)
					.orderBy(desc(lesson.startsAt))
					.limit(4)
			: Promise.resolve([])) as Promise<
			{
				id: number;
				startsAt: Date;
				subjectName: string | null;
				tutorName: string | null;
				tutorSlug: string | null;
				attendance: 'completed' | 'absent' | null;
			}[]
		>
	]);
	const requests = access.guardian ? await requestsForUser(locals.db, id) : [];
	// the newest homework with where it stands: waiting, handed in (on time / late), or the
	// tutor's mark (done / late / missing). Hand-ins and marks show here at once.
	const hwRows: {
		id: number;
		title: string;
		dueOn: string | null;
		dueTime: string | null;
		subject: string | null;
		mark: 'done' | 'late' | 'missing' | null;
		handedInAt: Date | null;
	}[] = access.homework
		? await locals.db
				.select({
					id: homework.id,
					title: homework.title,
					dueOn: homework.dueOn,
					dueTime: homework.dueTime,
					subject: homework.subject,
					mark: homework.mark,
					handedInAt: sql<Date | null>`(select min(a.created_at) from homework_answer a where a.homework_id = ${homework.id})`
				})
				.from(homework)
				.where(eq(homework.userId, id))
				.orderBy(desc(homework.createdAt))
				.limit(8)
		: [];
	const hw = hwRows.map((h) => {
		const inAt = h.handedInAt ? new Date(h.handedInAt) : null;
		const late = !!inAt && handedInLate(inAt, h.dueOn, h.dueTime);
		return {
			id: h.id,
			title: h.title,
			dueOn: h.dueOn,
			dueTime: h.dueTime,
			subject: h.subject,
			status: (h.mark ?? (inAt ? (late ? 'in_late' : 'in') : 'waiting')) as
				'done' | 'late' | 'missing' | 'in' | 'in_late' | 'waiting'
		};
	});
	if (!child) error(404, 'Not found');
	// reports the child's tutors sent (stored in Tutora), when the child shares progress
	// Tutora Family covers this child? (the page itself is free; reports are a Family feature)
	const familyCovered = await childCovered(locals.db, u.id, id);
	const reports = access.progress && familyCovered ? await sentReportsFor(locals.db, id, 3) : [];
	const [reportTutors, recs] = await Promise.all([
		tutorNames(
			locals.db,
			reports.map((r) => r.tutorId)
		),
		// Tutora recommended tutors for this child (Family; a teaser on the free level)
		recommendationsFor(locals.db, u.id, [id])
	]);
	return {
		familyCovered,
		lockedFeature:
			familyCovered ||
			!(Object.values(FAMILY_FEATURES) as string[]).includes(url.searchParams.get('locked') ?? '')
				? null
				: url.searchParams.get('locked'),
		reports: reports.map((r) => ({
			id: r.id,
			periodStart: r.periodStart,
			periodEnd: r.periodEnd,
			note: r.note,
			figures: r.figures,
			sentAt: r.sentAt,
			tutorName: reportTutors.get(r.tutorId) ?? ''
		})),
		child,
		level: kid?.level ?? null,
		guardian: access.guardian,
		photo: photos.get(id) ?? null,
		readsMessages: readers.includes(u.id),
		recommended: recs.get(id) ?? { locked: true as const, count: 3 },
		tutors: tutors
			.filter((t) => t.status === 'active')
			.map((t) => ({ slug: t.slug, name: t.name })),
		sharesReport,
		schoolPlus: sp ?? null,
		homework: hw,
		past,
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
		if (accepted) await afterAccept(locals.db, accepted);
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
