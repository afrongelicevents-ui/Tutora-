import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import {
	daySummaryLine,
	goals,
	personalHistory,
	personalInsight,
	setShareReport,
	shareReport,
	today,
	weekStats
} from '#lib/server/planner.ts';
import { weekPattern } from '#lib/server/checkins.ts';
import { checkinActions, checkinView } from '#lib/server/checkin-actions.ts';
import { reportShared } from '#lib/server/events.ts';
import { familyOf } from '#lib/server/family.ts';
import { shortName } from '#lib/names.ts';
import { isIsoDate } from '#lib/tz.ts';

/**
 * My personal report: today (plan vs done, tasks, check-ins, a short summary), this week
 * (days followed, tasks per day, feelings, goals, one insight) and past days. Personal
 * wellbeing and organisation only; school results stay on Progress.
 */
export const load: PageServerLoad = async ({ locals, url }) => {
	const u = requireRole(locals.user, url, ['student']);
	const now = new Date();
	const before = url.searchParams.get('before');
	const [t, cv, w, g, feelings, hist, shared, family] = await Promise.all([
		today(locals.db, u.id, now),
		checkinView(locals.db, u.id, now),
		weekStats(locals.db, u.id, now),
		goals(locals.db, u.id, now),
		weekPattern(locals.db, u.id, now),
		personalHistory(locals.db, u.id, {
			before: before && isIsoDate(before) ? before : undefined
		}),
		shareReport(locals.db, u.id),
		familyOf(locals.db, u.id)
	]);
	const startMood = cv.ck.start?.mood ?? null;
	const endMood = cv.ck.followup?.mood ?? null;
	return {
		today: t,
		...cv,
		summary: daySummaryLine(t.stats, startMood, endMood),
		week: w,
		goals: g.active,
		goalsReachedThisWeek: g.reachedThisWeek,
		insight: personalInsight(w, g.reachedThisWeek),
		feelings,
		history: hist.days.map((d) => ({
			...d,
			line: daySummaryLine(d, d.startMood, d.endMood)
		})),
		olderFrom: hist.olderFrom,
		moreHistory: hist.more,
		paged: !!before,
		shared,
		family: family.filter((f) => f.status === 'active').map((f) => f.label || shortName(f.name))
	};
};

export const actions: Actions = {
	...checkinActions,
	shareReport: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['student']);
		const yes = (await request.formData()).get('answer') === 'yes';
		const before = await shareReport(locals.db, u.id);
		await setShareReport(locals.db, u.id, yes);
		if (yes && !before) await reportShared(locals.db, u.id);
		return { reportShared: yes };
	}
};
