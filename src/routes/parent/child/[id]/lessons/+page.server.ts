import { error } from '@sveltejs/kit';
import { and, desc, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { parentAccess, childrenOf } from '#lib/server/family.ts';
import { requireRole } from '#lib/server/guards.ts';
import { attendee, lesson, subject, tutorProfile } from '#lib/server/db/app.schema.ts';
import { CLOSE_AFTER_MIN } from '#lib/server/room.ts';
import { shortName } from '#lib/names.ts';

/** All of one child's lessons ("See all" from the child page), when the child shares lessons. */
export const load: PageServerLoad = async ({ locals, url, params }) => {
	const u = requireRole(locals.user, url, ['parent']);
	const id = params.id;
	const [access, kids] = await Promise.all([
		parentAccess(locals.db, u.id, id),
		childrenOf(locals.db, u.id)
	]);
	const kid = kids.find((k) => k.studentId === id);
	if (!access.ok || !kid) error(404, 'Not found');
	const list = () =>
		locals.db
			.select({
				id: lesson.id,
				startsAt: lesson.startsAt,
				endsAt: lesson.endsAt,
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
				and(eq(attendee.userId, id), eq(attendee.status, 'booked'), eq(lesson.status, 'scheduled'))
			)
			.orderBy(desc(lesson.startsAt))
			.limit(200);
	type Row = {
		id: number;
		startsAt: Date;
		endsAt: Date;
		subjectName: string | null;
		tutorName: string | null;
		tutorSlug: string | null;
		attendance: 'completed' | 'absent' | null;
	};
	const rows: Row[] = access.lessons ? ((await list()) as Row[]) : [];
	const cut = Date.now() - CLOSE_AFTER_MIN * 60_000;
	return {
		childId: id,
		firstName: shortName(kid.name ?? ''),
		shared: access.lessons,
		guardian: access.guardian,
		upcoming: rows.filter((r) => r.endsAt.getTime() > cut).reverse(),
		past: rows.filter((r) => r.endsAt.getTime() <= cut)
	};
};
