import { shortName } from '#lib/names.ts';
import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import {
	addCheckin,
	isMood,
	MOOD_KEY,
	setCheckinShared,
	todaysCheckin
} from '#lib/server/checkins.ts';
import { activeParents, familyOf } from '#lib/server/family.ts';
import { streak, todaysPlan, weekSummary } from '#lib/server/study.ts';
import { homeworkDueCount, nextLessonFor, toolsSummary } from '#lib/server/student-home.ts';
import { attentionFor } from '#lib/server/student.ts';
import { notifyUser } from '#lib/server/notify.ts';
import { formObject } from '#lib/validation/auth.ts';
import { local } from '#lib/tz.ts';
import { t } from '#lib/i18n.ts';
import { m } from '#lib/paraglide/messages.js';
import { user } from '#lib/server/db/auth.schema.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	const u = requireRole(locals.user, url, ['student']);
	const now = new Date();
	const [next, plan, days, week, checkin, family, due, tools, attention] = await Promise.all([
		nextLessonFor(locals.db, u.id, now),
		todaysPlan(locals.db, u.id, now),
		streak(locals.db, u.id, now),
		weekSummary(locals.db, u.id, now),
		todaysCheckin(locals.db, u.id, now),
		familyOf(locals.db, u.id),
		homeworkDueCount(locals.db, u.id, now),
		toolsSummary(locals.db, u.id),
		attentionFor(locals.db, u.id, now)
	]);
	const hour = local(now).minutes / 60;
	return {
		now,
		firstName: shortName(u.name),
		partOfDay: hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening',
		next,
		plan,
		streak: days,
		week,
		checkin: checkin ? { mood: checkin.mood, shared: checkin.sharedWithFamily } : null,
		checkinId: checkin?.id ?? null,
		// who would see a shared check-in (their label, or first name)
		family: family.filter((f) => f.status === 'active').map((f) => f.label || shortName(f.name)),
		due,
		tools,
		attention: attention.filter(
			(a) => a.kind === 'owe' || a.kind === 'proposal' || a.kind === 'payment_declined'
		)
	};
};

export const actions: Actions = {
	/** A learning check-in. The student decides whether family sees it. */
	checkin: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['student']);
		const f = formObject(await request.formData());
		if (!isMood(f.mood)) return fail(400, { error: 'err_generic' });
		const shared = f.share === 'on';
		await addCheckin(locals.db, u.id, {
			mood: f.mood,
			shared,
			note: f.note ?? null
		});
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
	}
};
