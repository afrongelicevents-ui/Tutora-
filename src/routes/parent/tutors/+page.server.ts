import type { PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { childrenOf, parentAccess } from '#lib/server/family.ts';
import { tutorsForUser } from '#lib/server/people.ts';
import { readingParents } from '#lib/server/messages.ts';
import { lessonsForUser } from '#lib/server/bookings.ts';
import { childPhotos } from '#lib/server/parent-home.ts';
import { CLOSE_AFTER_MIN } from '#lib/server/room.ts';
import { shortName } from '#lib/names.ts';
import { recommendationsFor } from '#lib/server/recommend.ts';

/** The family's tutors, per child: who teaches whom, upcoming lessons, messages, booking. */
export const load: PageServerLoad = async ({ locals, url }) => {
	const u = requireRole(locals.user, url, ['parent']);
	const kids = (await childrenOf(locals.db, u.id)).filter((k) => k.status === 'active');
	const ids = kids.map((k) => k.studentId);
	// Tutora recommended tutors (Family, per child) in the same round as the photos
	const [photos, recs] = await Promise.all([
		childPhotos(locals.db, ids),
		recommendationsFor(locals.db, u.id, ids)
	]);
	const now = Date.now();
	const rows = await Promise.all(
		kids.map(async (k) => {
			const access = await parentAccess(locals.db, u.id, k.studentId);
			if (!access.ok) return null;
			const [tutors, readers, lessons] = await Promise.all([
				tutorsForUser(locals.db, k.studentId),
				readingParents(locals.db, k.studentId),
				access.lessons ? lessonsForUser(locals.db, k.studentId) : Promise.resolve([])
			]);
			return {
				id: k.studentId,
				name: shortName(k.name),
				photo: photos.get(k.studentId) ?? null,
				guardian: access.guardian,
				lessonsShared: access.lessons,
				readsMessages: readers.includes(u.id),
				recommended: recs.get(k.studentId) ?? { locked: true as const, count: 3 },
				tutors: tutors
					.filter((t) => t.status === 'active')
					.map((t) => ({ slug: t.slug, name: t.name ?? '' })),
				upcoming: lessons
					.filter(
						(l) =>
							l.status !== 'cancelled' &&
							l.attendeeStatus === 'booked' &&
							l.endsAt.getTime() + CLOSE_AFTER_MIN * 60_000 > now
					)
					.slice(0, 3)
					.map((l) => ({
						id: l.id,
						startsAt: l.startsAt,
						subjectName: l.subjectName,
						tutorName: l.tutorName
					}))
			};
		})
	);
	return { kids: rows.filter((r) => !!r) };
};
