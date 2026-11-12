import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import {
	addPlanItem,
	endSession,
	planFor,
	removePlanItem,
	runningSession,
	startSession,
	streak,
	tellFamilyStudy,
	todaysPlan,
	weekSummary
} from '#lib/server/study.ts';
import { addExam, examReadiness, removeExam } from '#lib/server/progress.ts';
import { checkDoneToday, myAssignments } from '#lib/server/assessments.ts';
import { notifyUser, type NotifyOpts } from '#lib/server/notify.ts';
import { hhmmToMinutes, isIsoDate, localDate } from '#lib/tz.ts';

const me = (locals: App.Locals, url: URL) => requireRole(locals.user, url, ['student']).id;

const int = (v: FormDataEntryValue | null) => {
	const n = Number(v);
	return Number.isInteger(n) ? n : NaN;
};
const text = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v.trim() : '');

export const load: PageServerLoad = async ({ locals, url }) => {
	const id = me(locals, url);
	const db = locals.db;
	const now = new Date();
	const [plan, today, running, days, week, quizzes, exams, check] = await Promise.all([
		planFor(db, id),
		todaysPlan(db, id, now),
		runningSession(db, id),
		streak(db, id, now),
		weekSummary(db, id, now),
		myAssignments(db, id),
		examReadiness(db, id, now),
		checkDoneToday(db, id, now)
	]);
	return {
		// from Home ("Resume lesson") or a subject page: fill in the focus-session subject
		prefillSubject: (url.searchParams.get('subject') ?? '').trim().slice(0, 60),
		now,
		today: localDate(now),
		plan: plan.map((p) => ({
			id: p.id,
			weekday: p.weekday,
			startMinute: p.startMinute,
			minutes: p.minutes,
			subject: p.subject,
			topic: p.topic
		})),
		todayPlan: today,
		running: running
			? {
					id: running.id,
					subject: running.subject,
					topic: running.topic,
					startedAt: running.startedAt,
					endsAt: new Date(running.startedAt.getTime() + running.plannedMinutes * 60_000),
					plannedMinutes: running.plannedMinutes
				}
			: null,
		streak: days,
		week,
		quizzes,
		exams,
		check
	};
};

export const actions: Actions = {
	addSlot: async ({ locals, url, request }) => {
		const id = me(locals, url);
		const f = await request.formData();
		const weekday = int(f.get('weekday'));
		const start = hhmmToMinutes(text(f.get('start')));
		const minutes = int(f.get('minutes'));
		const subject = text(f.get('subject'));
		if (!(weekday >= 0 && weekday <= 6) || start === null || start > 1439)
			return fail(400, { error: 'st5_err_slot', form: 'slot' });
		if (!(minutes >= 5 && minutes <= 240))
			return fail(400, { error: 'st5_err_minutes', form: 'slot' });
		if (!subject) return fail(400, { error: 'st5_err_subject', form: 'slot' });
		const row = await addPlanItem(locals.db, id, id, {
			weekday,
			startMinute: start,
			minutes,
			subject,
			topic: text(f.get('topic')) || null
		});
		if (!row) return fail(400, { error: 'st5_err_slot', form: 'slot' });
		return { done: 'slot' };
	},

	removeSlot: async ({ locals, url, request }) => {
		const id = me(locals, url);
		const slot = int((await request.formData()).get('id'));
		if (slot > 0) await removePlanItem(locals.db, id, slot);
		return { done: 'slot_removed' };
	},

	start: async ({ locals, url, request }) => {
		const id = me(locals, url);
		const f = await request.formData();
		const planItemId = int(f.get('planItemId'));
		const minutes = int(f.get('minutes'));
		const subject = text(f.get('subject'));
		if (!(planItemId > 0) && !subject)
			return fail(400, { error: 'st5_err_subject', form: 'start' });
		if (!(planItemId > 0) && !(minutes >= 5 && minutes <= 240))
			return fail(400, { error: 'st5_err_minutes', form: 'start' });
		const s = await startSession(locals.db, id, {
			planItemId: planItemId > 0 ? planItemId : null,
			subject: subject || '-',
			topic: text(f.get('topic')) || null,
			minutes: minutes > 0 ? minutes : 25
		});
		if (!s) return fail(400, { error: 'st5_err_subject', form: 'start' });
		await tellFamilyStudy(locals.db, notifier(locals), id, s, 'started');
		return { done: 'started' };
	},

	finish: async ({ locals, url, request }) => {
		const id = me(locals, url);
		const s = await endSession(locals.db, id, int((await request.formData()).get('id')), true);
		if (!s) return fail(400, { error: 'st5_err_no_session' });
		await tellFamilyStudy(locals.db, notifier(locals), id, s, 'finished');
		return { done: 'finished' };
	},

	/** Stopped early: saved for the student, but the family is not told. */
	stop: async ({ locals, url, request }) => {
		const id = me(locals, url);
		const s = await endSession(locals.db, id, int((await request.formData()).get('id')), false);
		if (!s) return fail(400, { error: 'st5_err_no_session' });
		return { done: 'stopped' };
	},

	addExam: async ({ locals, url, request }) => {
		const id = me(locals, url);
		const f = await request.formData();
		const subject = text(f.get('subject'));
		const title = text(f.get('title'));
		const examOn = text(f.get('examOn'));
		const topics = text(f.get('topics'))
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);
		if (!subject || !title) return fail(400, { error: 'st5_err_exam', form: 'exam' });
		if (examOn && !isIsoDate(examOn)) return fail(400, { error: 'st5_err_date', form: 'exam' });
		if (!topics.length) return fail(400, { error: 'st5_err_topics', form: 'exam' });
		await addExam(locals.db, id, id, { subject, title, examOn: examOn || null, topics });
		return { done: 'exam' };
	},

	removeExam: async ({ locals, url, request }) => {
		const id = me(locals, url);
		const exam = int((await request.formData()).get('id'));
		if (exam > 0) await removeExam(locals.db, id, exam);
		return { done: 'exam_removed' };
	}
};

function notifier(locals: App.Locals) {
	return (userId: string, subject: string, body: string, opts?: NotifyOpts) =>
		notifyUser(locals.db, userId, subject, body, opts);
}
