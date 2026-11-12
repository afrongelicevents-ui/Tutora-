/**
 * The learning check-in card's form actions and data, shared by Progress and the personal
 * report (both show the same card).
 */
import { fail, type RequestEvent } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { requireRole } from './guards.ts';
import {
	addCheckin,
	answerShare,
	isMood,
	MOOD_KEY,
	needsTalkSuggestion,
	setCheckinNote,
	setCheckinShared,
	sharePref,
	studyingNow,
	todayState,
	type CheckinMood
} from './checkins.ts';
import { activeParents } from './family.ts';
import { notifyUser } from './notify.ts';
import { checkin as checkinTable } from './db/v3.schema.ts';
import { user } from './db/auth.schema.ts';
import type { DB } from './db/types.ts';
import { formObject } from '../validation/auth.ts';
import { shortName } from '../names.ts';
import { t } from '../i18n.ts';
import { m } from '../paraglide/messages.js';

/** Data for the check-in card. */
export async function checkinView(db: DB, studentId: string, now = new Date()) {
	const [ck, studying, talk] = await Promise.all([
		todayState(db, studentId, now),
		studyingNow(db, studentId, now),
		needsTalkSuggestion(db, studentId, now)
	]);
	return {
		ck: {
			start: ck.start
				? {
						id: ck.start.id,
						mood: ck.start.mood,
						shared: ck.start.sharedWithFamily,
						subject: ck.start.subject,
						note: ck.start.note,
						// the subject today's message talks about (from the check-in or the plan)
						planSubject: ck.start.subject ?? studying
					}
				: null,
			followup: ck.followup
				? { id: ck.followup.id, mood: ck.followup.mood, shared: ck.followup.sharedWithFamily }
				: null,
			askFollowup: ck.askFollowup,
			studying
		},
		talk
	};
}

type Ev = RequestEvent;

export const checkinActions = {
	/** A learning check-in (or "How did it go?"). Sharing follows the remembered choice. */
	checkin: async ({ locals, url, request }: Ev) => {
		const u = requireRole(locals.user, url, ['student']);
		const f = formObject(await request.formData());
		if (!isMood(f.mood)) return fail(400, { error: 'err_generic' });
		const now = new Date();
		const followupOf = Number(f.followupOf) || null;
		const state = await todayState(locals.db, u.id, now);
		// a follow-up only answers today's own start check-in
		const isFollowup = !!followupOf && state.start?.id === followupOf;
		const shared = await sharePref(locals.db, u.id);
		const subject = isFollowup
			? (state.start?.subject ?? null)
			: await studyingNow(locals.db, u.id, now);
		await addCheckin(locals.db, u.id, {
			mood: f.mood,
			shared,
			subject,
			kind: isFollowup ? 'followup' : 'start',
			followupOf: isFollowup ? followupOf : null
		});
		if (shared) await tellFamily(locals.db, u.id, f.mood);
		return { checked: f.mood, shared };
	},
	/** "Share with my parent?" Yes / No: this check-in, and remembered for the next ones. */
	shareAnswer: async ({ locals, url, request }: Ev) => {
		const u = requireRole(locals.user, url, ['student']);
		const f = formObject(await request.formData());
		const id = Number(f.id) || 0;
		const yes = f.answer === 'yes';
		const [row] = await locals.db
			.select({ mood: checkinTable.mood, shared: checkinTable.sharedWithFamily })
			.from(checkinTable)
			.where(and(eq(checkinTable.id, id), eq(checkinTable.studentId, u.id)));
		if (!row) return fail(400, { error: 'err_generic' });
		await answerShare(locals.db, u.id, id, yes);
		if (yes && !row.shared) await tellFamily(locals.db, u.id, row.mood);
		return { shareAnswered: yes ? 'yes' : 'no' };
	},
	/** What they're studying and an optional short note, on their own check-in. */
	note: async ({ locals, url, request }: Ev) => {
		const u = requireRole(locals.user, url, ['student']);
		const f = formObject(await request.formData());
		await setCheckinNote(locals.db, u.id, Number(f.id) || 0, {
			note: f.note ?? '',
			subject: f.subject ?? ''
		});
		return { noteSaved: true };
	},
	/** Change your mind about sharing one of your own check-ins. */
	share: async ({ locals, url, request }: Ev) => {
		const u = requireRole(locals.user, url, ['student']);
		const f = formObject(await request.formData());
		await setCheckinShared(locals.db, u.id, Number(f.id) || 0, f.shared === 'on');
		return null;
	}
};

/** Tell the student's active family about a check-in the student chose to share. */
async function tellFamily(db: DB, studentId: string, mood: CheckinMood) {
	const [me] = await db.select({ name: user.name }).from(user).where(eq(user.id, studentId));
	const first = shortName(me?.name ?? '');
	for (const parentId of await activeParents(db, studentId))
		await notifyUser(
			db,
			parentId,
			m.ci_notify_s({ name: first }),
			m.ci_notify_b({ mood: t(MOOD_KEY[mood]) }),
			{ kind: 'family', link: `/parent?child=${encodeURIComponent(studentId)}` }
		);
}
