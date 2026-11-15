/**
 * The parent side's shared data: one card per child and the family's month. Every figure
 * comes from real rows and respects what each child shares (parentAccess). Few queries per
 * child (counts in one statement, the 30-day progress in one statement) so the page stays
 * inside the Workers free CPU budget.
 */
import { inArray, sql } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { studentCard } from './db/buddies.schema.ts';
import { parentAccess, type Access } from './family.ts';
import { lessonsForUser } from './bookings.ts';
import { CLOSE_AFTER_MIN } from './room.ts';
import { pct } from './progress.ts';
import { addDays, local, localDate, startOfLocalWeek } from '../tz.ts';
import { shortName } from '../names.ts';

export interface Kid {
	id: string;
	name: string;
	level: string | null;
	status: string;
	guardian: boolean;
	managed: boolean;
}

const rowsOf = <T>(r: unknown): T[] => ((r as { rows?: T[] }).rows ?? (r as T[])) as T[];

/** Approved profile photos only (the same rule as Study Buddies). */
export async function childPhotos(db: DB, ids: string[]): Promise<Map<string, string>> {
	const out = new Map<string, string>();
	if (!ids.length) return out;
	const rows = await db
		.select({ id: studentCard.userId, key: studentCard.photoKey, status: studentCard.photoStatus })
		.from(studentCard)
		.where(inArray(studentCard.userId, ids));
	for (const r of rows)
		if (r.key && r.status === 'approved')
			out.set(r.id, `/profile-photo/${encodeURIComponent(r.id)}`);
	return out;
}

interface Counts {
	tutors: number;
	hw_due: number;
	hw_late: number;
	proposed: number;
	share_report: boolean;
	cur_s: number;
	cur_m: number;
	cur_n: number;
	prev_s: number;
	prev_m: number;
	prev_n: number;
}

/** Counts and the 30-day progress for one child, in a single statement. */
async function counts(db: DB, id: string, now: Date): Promise<Counts> {
	const today = localDate(now);
	const in7 = localDate(addDays(now, 7));
	const d30 = localDate(addDays(now, -29));
	const d60 = localDate(addDays(now, -59));
	const tomorrow = localDate(addDays(now, 1));
	const r = await db.execute(sql`
		select
			(select count(*)::int from enrollment e join tutor_profile tp on tp.tutor_id = e.tutor_id
				where e.user_id = ${id} and tp.status = 'active') as tutors,
			(select count(*)::int from homework h left join homework_answer a on a.homework_id = h.id
				where h.user_id = ${id} and a.id is null and h.due_on >= ${today} and h.due_on <= ${in7}) as hw_due,
			(select count(*)::int from homework h left join homework_answer a on a.homework_id = h.id
				where h.user_id = ${id} and a.id is null and h.due_on < ${today}
				and h.due_on >= ${localDate(addDays(now, -30))}) as hw_late,
			(select count(*)::int from booking b where b.user_id = ${id} and b.status = 'proposed') as proposed,
			coalesce((select share_report from personal_pref where student_id = ${id}), false) as share_report,
			coalesce(sum(score) filter (where taken_on >= ${d30} and taken_on < ${tomorrow}), 0)::int as cur_s,
			coalesce(sum(max_score) filter (where taken_on >= ${d30} and taken_on < ${tomorrow}), 0)::int as cur_m,
			(count(*) filter (where taken_on >= ${d30} and taken_on < ${tomorrow}))::int as cur_n,
			coalesce(sum(score) filter (where taken_on >= ${d60} and taken_on < ${d30}), 0)::int as prev_s,
			coalesce(sum(max_score) filter (where taken_on >= ${d60} and taken_on < ${d30}), 0)::int as prev_m,
			(count(*) filter (where taken_on >= ${d60} and taken_on < ${d30}))::int as prev_n
		from assessment_result where student_id = ${id} and taken_on >= ${d60}`);
	return rowsOf<Counts>(r)[0];
}

/** Weekly goals reached since a date (a goal kept on its target number of days in a week). */
async function goalsReachedSince(db: DB, id: string, since: string): Promise<number> {
	const r = await db.execute(sql`
		select g.id, g.target_days as target, t.on_date::text as d
		from personal_goal g join goal_tick t on t.goal_id = g.id
		where g.student_id = ${id} and t.on_date >= ${since}`);
	const per = new Map<string, number>();
	const target = new Map<number, number>();
	for (const x of rowsOf<{ id: number; target: number; d: string }>(r)) {
		const week = localDate(startOfLocalWeek(new Date(x.d + 'T12:00:00Z')));
		const k = `${x.id}|${week}`;
		per.set(k, (per.get(k) ?? 0) + 1);
		target.set(x.id, x.target);
	}
	let n = 0;
	for (const [k, v] of per) if (v >= (target.get(Number(k.split('|')[0])) ?? 8)) n++;
	return n;
}

export interface ChildCard {
	id: string;
	name: string;
	firstName: string;
	level: string | null;
	photo: string | null;
	guardian: boolean;
	access: Access;
	overall: { pct: number; change: number | null } | null;
	next: { startsAt: Date; subjectName: string | null; tutorName: string | null } | null;
	tutors: number;
	attention: { proposed: number; homeworkDue: number; homeworkLate: number; total: number };
	/** this month (Zimbabwe time) */
	month: { hours: number | null; goals: number | null };
}

/** Everything the Home cards and the family overview need, for each active child. */
export async function childCards(
	db: DB,
	parentId: string,
	kids: Kid[],
	now = new Date()
): Promise<ChildCard[]> {
	const active = kids.filter((k) => k.status === 'active');
	const photos = await childPhotos(
		db,
		active.map((k) => k.id)
	);
	const p = local(now);
	const monthStart = `${p.year}-${String(p.month).padStart(2, '0')}-01`;
	const cards = await Promise.all(
		active.map(async (k): Promise<ChildCard | null> => {
			const access = await parentAccess(db, parentId, k.id);
			if (!access.ok) return null;
			const [c, lessons] = await Promise.all([
				counts(db, k.id, now),
				access.lessons ? lessonsForUser(db, k.id) : Promise.resolve([])
			]);
			const goals = c.share_report ? await goalsReachedSince(db, k.id, monthStart) : null;
			const booked = lessons.filter(
				(l) => l.status !== 'cancelled' && l.attendeeStatus === 'booked'
			);
			const next =
				booked.find((l) => l.endsAt.getTime() + CLOSE_AFTER_MIN * 60_000 > now.getTime()) ?? null;
			// tutoring time this month: booked lessons that have finished
			const done = booked.filter(
				(l) => localDate(l.startsAt) >= monthStart && l.endsAt.getTime() <= now.getTime()
			);
			const minutes = done.reduce(
				(a, l) => a + (l.endsAt.getTime() - l.startsAt.getTime()) / 60_000,
				0
			);
			const cur = c.cur_n ? pct(c.cur_s, c.cur_m) : null;
			const prev = c.prev_n ? pct(c.prev_s, c.prev_m) : null;
			const homeworkDue = access.homework ? c.hw_due : 0;
			const homeworkLate = access.homework ? c.hw_late : 0;
			const proposed = k.guardian ? c.proposed : 0;
			return {
				id: k.id,
				name: k.name,
				firstName: shortName(k.name),
				level: k.level,
				photo: photos.get(k.id) ?? null,
				guardian: k.guardian,
				access,
				overall:
					access.progress && cur !== null
						? { pct: cur, change: prev !== null ? cur - prev : null }
						: null,
				next: next
					? { startsAt: next.startsAt, subjectName: next.subjectName, tutorName: next.tutorName }
					: null,
				tutors: c.tutors,
				attention: {
					proposed,
					homeworkDue,
					homeworkLate,
					total: proposed + homeworkLate + homeworkDue
				},
				month: {
					hours: access.lessons ? Math.round((minutes / 60) * 10) / 10 : null,
					goals
				}
			};
		})
	);
	return cards.filter((x): x is ChildCard => !!x);
}

/** The family's month: only tiles that have real data. */
export function familyMonth(cards: ChildCard[]) {
	const hours = cards.map((c) => c.month.hours).filter((h): h is number => h !== null);
	const changes = cards
		.map((c) => c.overall?.change)
		.filter((x): x is number => typeof x === 'number');
	const goals = cards.map((c) => c.month.goals).filter((g): g is number => g !== null);
	return {
		hours: hours.length ? Math.round(hours.reduce((a, b) => a + b, 0) * 10) / 10 : null,
		growth: changes.length ? Math.round(changes.reduce((a, b) => a + b, 0) / changes.length) : null,
		goals: goals.length ? goals.reduce((a, b) => a + b, 0) : null
	};
}

/** "Good morning / afternoon / evening" by Zimbabwe time. */
export function greetingKey(now = new Date()): 'morning' | 'afternoon' | 'evening' {
	const h = local(now).minutes / 60;
	return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}
