import { error } from '@sveltejs/kit';
import { desc, eq, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { parentAccess, childrenOf } from '#lib/server/family.ts';
import { requireRole } from '#lib/server/guards.ts';
import { homework } from '#lib/server/db/app.schema.ts';
import { handedInLate } from '#lib/server/homework-status.ts';
import { shortName } from '#lib/names.ts';

/** All of one child's homework ("See all" from the child page), when the child shares it. */
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
			.limit(200);
	type Row = {
		id: number;
		title: string;
		dueOn: string | null;
		dueTime: string | null;
		subject: string | null;
		mark: 'done' | 'late' | 'missing' | null;
		handedInAt: Date | null;
	};
	const rows: Row[] = access.homework ? ((await list()) as Row[]) : [];
	return {
		childId: id,
		firstName: shortName(kid.name ?? ''),
		shared: access.homework,
		homework: rows.map((h) => {
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
		})
	};
};
