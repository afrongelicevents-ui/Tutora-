import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import {
	examReadiness,
	overallProgress,
	recentResults,
	topicScores,
	WEAK_PCT
} from '#lib/server/progress.ts';
import { planFor, weekSummary } from '#lib/server/study.ts';
import {
	removeSchoolSubject,
	saveSchoolInfo,
	saveSchoolSubject,
	schoolWork
} from '#lib/server/school.ts';
import { formObject } from '#lib/validation/auth.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	const u = requireRole(locals.user, url, ['student']);
	const now = new Date();
	const [overall, topics, exams, week, school, results, plan] = await Promise.all([
		overallProgress(locals.db, u.id, now),
		topicScores(locals.db, u.id),
		examReadiness(locals.db, u.id, now),
		weekSummary(locals.db, u.id, now),
		schoolWork(locals.db, u.id),
		recentResults(locals.db, u.id, 8),
		planFor(locals.db, u.id)
	]);
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
