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
import { shortName } from '#lib/names.ts';
import { eq } from 'drizzle-orm';
import {
	addCheckin,
	isMood,
	MOOD_KEY,
	setCheckinShared,
	todaysCheckin
} from '#lib/server/checkins.ts';
import { activeParents, familyOf } from '#lib/server/family.ts';
import { notifyUser } from '#lib/server/notify.ts';
import { t } from '#lib/i18n.ts';
import { m } from '#lib/paraglide/messages.js';
import { user } from '#lib/server/db/auth.schema.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	const u = requireRole(locals.user, url, ['student']);
	const now = new Date();
	const [overall, topics, exams, week, school, results, plan, checkin, family] = await Promise.all([
		overallProgress(locals.db, u.id, now),
		topicScores(locals.db, u.id),
		examReadiness(locals.db, u.id, now),
		weekSummary(locals.db, u.id, now),
		schoolWork(locals.db, u.id),
		recentResults(locals.db, u.id, 8),
		planFor(locals.db, u.id),
		todaysCheckin(locals.db, u.id, now),
		familyOf(locals.db, u.id)
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
		// learning check-in (moved here from Home): the student decides whether family sees it
		checkin: checkin ? { mood: checkin.mood, shared: checkin.sharedWithFamily } : null,
		checkinId: checkin?.id ?? null,
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
	/** A learning check-in. The student decides whether family sees it. */
	checkin: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['student']);
		const f = formObject(await request.formData());
		if (!isMood(f.mood)) return fail(400, { error: 'err_generic' });
		const shared = f.share === 'on';
		await addCheckin(locals.db, u.id, { mood: f.mood, shared, note: f.note ?? null });
		if (shared) {
			const [me] = await locals.db.select({ name: user.name }).from(user).where(eq(user.id, u.id));
			const first = shortName(me?.name ?? '');
			for (const parentId of await activeParents(locals.db, u.id))
				await notifyUser(
					locals.db,
					parentId,
					m.ci_notify_s({ name: first }),
					m.ci_notify_b({ mood: t(MOOD_KEY[f.mood]) }),
					{ kind: 'family', link: `/parent?child=${encodeURIComponent(u.id)}` }
				);
		}
		return { checked: f.mood, shared };
	},
	/** Change your mind about sharing one of your own check-ins. */
	share: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['student']);
		const f = formObject(await request.formData());
		await setCheckinShared(locals.db, u.id, Number(f.id) || 0, f.shared === 'on');
		return null;
	},
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
