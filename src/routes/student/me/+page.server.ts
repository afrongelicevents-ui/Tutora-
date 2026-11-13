import { and, desc, eq, gte, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { activeDays, streak, todaysPlan, weekSummary } from '#lib/server/study.ts';
import { examReadiness, READY_PCT, topicScores } from '#lib/server/progress.ts';
import { familyOf } from '#lib/server/family.ts';
import { homework, homeworkAnswer, profile } from '#lib/server/db/app.schema.ts';
import { checkin, schoolInfo } from '#lib/server/db/v3.schema.ts';
import { shortName } from '#lib/names.ts';
import { getCard } from '#lib/server/buddies.ts';
import { todaysBlocks } from '#lib/server/schedule.ts';
import { goals, today as plannerToday, weekStats, type PlanItem } from '#lib/server/planner.ts';
import { addDays, startOfLocalDay } from '#lib/tz.ts';

/**
 * "You": the student's own page. Profile, personal progress, today's plan, Family Connection,
 * exams and achievements. Every number comes from their own records; nothing is invented.
 */
export const load: PageServerLoad = async ({ locals, url }) => {
	const u = requireRole(locals.user, url, ['student']);
	const db = locals.db;
	const now = new Date();
	const since30 = addDays(now, -30);
	const [profRows, schoolRows, week, days, active] = await Promise.all([
		db.select({ level: profile.level }).from(profile).where(eq(profile.userId, u.id)),
		db
			.select({ school: schoolInfo.school, year: schoolInfo.year })
			.from(schoolInfo)
			.where(eq(schoolInfo.studentId, u.id)),
		weekSummary(db, u.id, now),
		streak(db, u.id, now),
		activeDays(db, u.id, addDays(startOfLocalDay(now), -13))
	]);
	const [today, family, exams, topics, card] = await Promise.all([
		todaysPlan(db, u.id, now),
		familyOf(db, u.id),
		examReadiness(db, u.id, now),
		topicScores(db, u.id),
		getCard(db, u.id)
	]);
	// today's personal timetable (school, meals, breaks, friends...) with study-plan slots
	const blocks = await todaysBlocks(db, u.id, now);
	// personal progress: today's plan, tasks, goals reached, today's feeling, this week
	const [pt, pg, pw, feelRows] = await Promise.all([
		plannerToday(db, u.id, now),
		goals(db, u.id, now),
		weekStats(db, u.id, now),
		db
			.select({ mood: checkin.mood })
			.from(checkin)
			.where(and(eq(checkin.studentId, u.id), gte(checkin.createdAt, startOfLocalDay(now))))
			.orderBy(desc(checkin.createdAt))
			.limit(1)
	]);
	const hwRows = await db
		.select({
			set: sql<number>`count(distinct ${homework.id})::int`,
			handed: sql<number>`count(distinct ${homeworkAnswer.homeworkId})::int`
		})
		.from(homework)
		.leftJoin(homeworkAnswer, eq(homeworkAnswer.homeworkId, homework.id))
		.where(and(eq(homework.userId, u.id), gte(homework.createdAt, since30)));
	const prof = profRows[0];
	const school = schoolRows[0];
	const hw = hwRows[0];
	const linked = family.filter((f) => f.status === 'active');
	return {
		name: u.name,
		// saved on the Edit profile screen (the student always sees their own)
		photoUrl: card?.photoKey ? `/profile-photo/${u.id}?v=${card.photoVersion}` : null,
		bio: card?.bio || null,
		firstName: shortName(u.name),
		// younger children sign in with a username; that address is not a real email
		email: u.email.endsWith('.invalid') ? null : u.email,
		// School+ details first, then what Edit profile saved on the card, then the level
		school: [school?.school || card?.school, school?.year || card?.grade || prof?.level]
			.filter(Boolean)
			.join(' · '),
		week: { done: week.done, planned: week.planned },
		streak: days,
		consistency: Math.round((100 * active.size) / 14),
		homework: { set: hw?.set ?? 0, handed: hw?.handed ?? 0 },
		today: today.map((s) => ({
			id: s.id,
			startMinute: s.startMinute,
			minutes: s.minutes,
			subject: s.subject,
			topic: s.topic,
			state: s.state
		})),
		personal: {
			pct: pt.stats.pct,
			tasksDone: pt.stats.tasksDone,
			tasksTotal: pt.stats.tasksTotal,
			achievements: pg.reached,
			feel: feelRows[0]?.mood ?? null,
			consistency: pw.consistency
		},
		// the timetable plus today's own planner tasks (timed ones in order, the rest at the end)
		blocks: [
			...blocks.map((b) => ({
				key: b.key,
				kind: b.kind as string,
				label: b.label,
				subject: b.subject,
				start: b.start as number | null,
				end: b.end as number | null,
				done: b.kind === 'study' && today.some((s) => `p${s.id}` === b.key && s.state === 'done')
			})),
			...pt.items
				.filter((i: PlanItem) => i.kind === 'task')
				.map((i: PlanItem) => ({
					key: i.key,
					kind: 'task',
					label: i.title,
					subject: null,
					start: i.start,
					end: null,
					done: i.done
				}))
		].sort((a, b) => (a.start ?? 1441) - (b.start ?? 1441)),
		onTrack: today.length > 0 && !today.some((s) => s.state === 'missed'),
		family: linked.map((f) => ({ name: f.label || shortName(f.name), guardian: f.guardian })),
		sees: {
			progress: linked.some((f) => f.shareProgress),
			lessons: linked.some((f) => f.shareLessons),
			homework: linked.some((f) => f.shareHomework),
			study: linked.some((f) => f.shareStudy)
		},
		examsAhead: exams.filter((e) => e.daysLeft === null || e.daysLeft >= 0).length,
		topicsReady: topics.filter((t) => t.pct >= READY_PCT).length
	};
};
