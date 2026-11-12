import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { childUpdates } from '#lib/server/parent.ts';
import { pickChild } from '#lib/server/parent-child.ts';
import { getPrefs } from '#lib/server/notify.ts';
import { notificationPref } from '#lib/server/db/app.schema.ts';
import { formObject } from '#lib/validation/auth.ts';

export const load: PageServerLoad = async ({ locals, url, cookies }) => {
	const u = requireRole(locals.user, url, ['parent']);
	const { kids, current } = await pickChild(locals.db, u.id, url, cookies);
	const items = current ? await childUpdates(locals.db, u.id, current) : null;
	const prefs = await getPrefs(locals.db, u.id);
	return {
		kids,
		current,
		items: (items ?? []).slice(0, 60),
		prefs: {
			study: !prefs.studyOff,
			lessons: !prefs.lessonsOff,
			homework: !prefs.homeworkOff,
			weekly: !prefs.weeklyOff,
			reminders: !prefs.remindersOff
		}
	};
};

export const actions: Actions = {
	prefs: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['parent']);
		const f = formObject(await request.formData());
		const v = {
			studyOff: f.study !== 'on',
			lessonsOff: f.lessons !== 'on',
			homeworkOff: f.homework !== 'on',
			weeklyOff: f.weekly !== 'on'
		};
		await locals.db
			.insert(notificationPref)
			.values({ userId: u.id, ...v })
			.onConflictDoUpdate({ target: notificationPref.userId, set: v });
		return { saved: true };
	}
};
