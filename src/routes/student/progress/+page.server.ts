import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import {
	examReadiness,
	overallProgress,
	recentResults,
	READY_PCT,
	topicScores,
	WEAK_PCT
} from '#lib/server/progress.ts';
import { planFor, streak, todaysPlan, weekSummary } from '#lib/server/study.ts';
import { lessonsForUser } from '#lib/server/bookings.ts';
import { OPEN_BEFORE_MIN, CLOSE_AFTER_MIN } from '#lib/server/room.ts';
import { local } from '#lib/tz.ts';
import {
	removeSchoolSubject,
	saveSchoolInfo,
	saveSchoolSubject,
	schoolWork
} from '#lib/server/school.ts';
import { formObject } from '#lib/validation/auth.ts';
import { checkinActions, checkinView } from '#lib/server/checkin-actions.ts';
import { shortName } from '#lib/names.ts';
import { todaysCheckin, weekPattern } from '#lib/server/checkins.ts';
import { familyOf } from '#lib/server/family.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	const u = requireRole(locals.user, url, ['student']);
	const now = new Date();
	const [
		overall,
		topics,
		exams,
		week,
		school,
		results,
		plan,
		checkin,
		family,
		today,
		days,
		lessons
	] = await Promise.all([
		overallProgress(locals.db, u.id, now),
		topicScores(locals.db, u.id),
		examReadiness(locals.db, u.id, now),
		weekSummary(locals.db, u.id, now),
		schoolWork(locals.db, u.id),
		recentResults(locals.db, u.id, 8),
		planFor(locals.db, u.id),
		todaysCheckin(locals.db, u.id, now),
		familyOf(locals.db, u.id),
		todaysPlan(locals.db, u.id, now),
		streak(locals.db, u.id, now),
		lessonsForUser(locals.db, u.id)
	]);
	// learning check-in card and the week of feelings
	const [cv, week7] = await Promise.all([
		checkinView(locals.db, u.id, now),
		weekPattern(locals.db, u.id, now)
	]);
	// subject scores: the mean of that subject's topic scores (each topic = its latest 3 marks)
	const bySubject = new Map<string, { name: string; sum: number; n: number; results: number }>();
	for (const tp of topics) {
		const k = tp.subject.toLowerCase();
		const cur = bySubject.get(k) ?? { name: tp.subject, sum: 0, n: 0, results: 0 };
		cur.sum += tp.pct;
		cur.n += 1;
		cur.results += tp.results;
		bySubject.set(k, cur);
	}
	const subjects = [...bySubject.values()]
		.sort((a, b) => b.results - a.results || a.name.localeCompare(b.name))
		.map((x) => ({ name: x.name, pct: Math.round(x.sum / x.n) }));
	const others = subjects.slice(3);
	const upcoming = lessons
		.filter((l) => l.endsAt.getTime() + CLOSE_AFTER_MIN * 60_000 > now.getTime())
		.slice(0, 3)
		.map((l) => ({
			id: l.id,
			subjectName: l.subjectName,
			tutorName: l.tutorName,
			kind: l.kind,
			startsAt: l.startsAt,
			endsAt: l.endsAt,
			open:
				l.mode === 'online' &&
				now.getTime() >= l.startsAt.getTime() - OPEN_BEFORE_MIN * 60_000 &&
				now.getTime() <= l.endsAt.getTime() + CLOSE_AFTER_MIN * 60_000
		}));
	const hour = local(now).minutes / 60;
	// the weakest topic, and whether the plan already makes time for it (real data only)
	const weak = [...topics].sort((a, b) => a.pct - b.pct).find((t) => t.pct < WEAK_PCT) ?? null;
	const weakExam = weak
		? exams.find(
				(e) =>
					e.subject.toLowerCase() === weak.subject.toLowerCase() &&
					e.topics.some((t) => t.topic.toLowerCase() === weak.topic.toLowerCase())
			)
		: null;
	const weakSlots = weak
		? plan.filter((p) => (p.topic ?? '').toLowerCase() === weak.topic.toLowerCase()).length
		: 0;
	return {
		now,
		firstName: shortName(u.name),
		partOfDay: hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening',
		streak: days,
		today,
		upcoming,
		subjectCards: {
			top: subjects.slice(0, 3),
			other: others.length
				? {
						n: others.length,
						pct: Math.round(others.reduce((a, x) => a + x.pct, 0) / others.length)
					}
				: null
		},
		topicsReady: { ready: topics.filter((tp) => tp.pct >= READY_PCT).length, total: topics.length },
		// learning check-in (moved here from Home): the student decides whether family sees it
		checkin: checkin ? { mood: checkin.mood, shared: checkin.sharedWithFamily } : null,
		checkinId: checkin?.id ?? null,
		...cv,
		week7,
		family: family.filter((f) => f.status === 'active').map((f) => f.label || shortName(f.name)),
		overall,
		topics,
		exams,
		week,
		school,
		weak: weak ? { ...weak, examDays: weakExam?.daysLeft ?? null, slots: weakSlots } : null,
		results: results.map((r) => ({
			id: r.id,
			title: r.title,
			subject: r.subject,
			topic: r.topic,
			score: r.score,
			maxScore: r.maxScore,
			feedback: r.feedback,
			takenOn: r.takenOn,
			source: r.source
		}))
	};
};

export const actions: Actions = {
	...checkinActions,
	school: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['student']);
		const f = formObject(await request.formData());
		await saveSchoolInfo(locals.db, u.id, u.id, { school: f.school, year: f.year });
		return { saved: 'school' };
	},
	subject: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['student']);
		const f = formObject(await request.formData());
		const row = await saveSchoolSubject(locals.db, u.id, u.id, Number(f.id) || null, {
			subject: f.subject ?? '',
			syllabus: f.syllabus,
			textbook: f.textbook,
			currentTopic: f.currentTopic
		});
		if (!row) return fail(400, { error: 'err_required' });
		return { saved: 'subject' };
	},
	removeSubject: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['student']);
		const f = formObject(await request.formData());
		await removeSchoolSubject(locals.db, u.id, Number(f.id) || 0);
		return { saved: 'removed' };
	}
};
