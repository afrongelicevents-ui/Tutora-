import { and, eq, gte, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { activeDays, streak, todaysPlan, weekSummary } from '#lib/server/study.ts';
import { examReadiness, READY_PCT, topicScores } from '#lib/server/progress.ts';
import { familyOf } from '#lib/server/family.ts';
import { homework, homeworkAnswer, profile } from '#lib/server/db/app.schema.ts';
import { schoolInfo } from '#lib/server/db/v3.schema.ts';
import { shortName } from '#lib/names.ts';
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
	const [today, family, exams, topics] = await Promise.all([
		todaysPlan(db, u.id, now),
		familyOf(db, u.id),
		examReadiness(db, u.id, now),
		topicScores(db, u.id)
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
		firstName: shortName(u.name),
		// younger children sign in with a username; that address is not a real email
		email: u.email.endsWith('.invalid') ? null : u.email,
		school: [school?.school, school?.year || prof?.level].filter(Boolean).join(' · '),
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
