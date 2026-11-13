import { together } from '#lib/server/together.ts';
import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import {
	getStudent,
	giveFeedback,
	giveHomework,
	homeworkForUser,
	setLevel,
	setLessonFeedback,
	setPrivateNote,
	studentLessons
} from '#lib/server/people.ts';
import { latestForTutor } from '#lib/server/checkins.ts';
import { recentResults, recordResult, topicScores } from '#lib/server/progress.ts';
import { checkSchoolSubject, schoolWork } from '#lib/server/school.ts';
import { inboxActions } from '#lib/server/actions/tutor-inbox.ts';
import { fmtDay } from '#lib/tz.ts';
import {
	balanceFor,
	packagesForUser,
	paymentsForUser,
	receiptNumber,
	recordCash
} from '#lib/server/billing.ts';
import { getSettings } from '#lib/server/settings.ts';
import { requireTutor } from '#lib/server/guards.ts';
import { fileLink, getStore } from '#lib/server/storage.ts';
import { DOC_KINDS, MB, newKey, readUpload } from '#lib/server/files.ts';
import { notifyUser } from '#lib/server/notify.ts';
import { formObject } from '#lib/validation/auth.ts';
import { parseMoney, formatMoney } from '#lib/money.ts';
import { isIsoDate, localDate } from '#lib/tz.ts';
import { attendee } from '#lib/server/db/app.schema.ts';
import { and, eq } from 'drizzle-orm';
import { m } from '#lib/paraglide/messages.js';

async function student(db: App.Locals['db'], tutorId: string, id: string) {
	// only this tutor's own students; anyone else is "not found"
	const s = await getStudent(db, tutorId, id);
	if (!s) error(404, 'Not found');
	return s;
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const t = requireTutor(locals.user, url).id;
	const s = await student(locals.db, t, params.id);
	const [
		lessons,
		balance,
		payments,
		packages,
		homework,
		settings,
		checkin,
		scores,
		results,
		school
	] = await Promise.all([
		studentLessons(locals.db, t, s.id),
		balanceFor(locals.db, t, s.id),
		paymentsForUser(locals.db, s.id, t),
		packagesForUser(locals.db, s.id, t),
		homeworkForUser(locals.db, s.id, t),
		getSettings(locals.db, t),
		// only what the student shares with tutors (never the private note)
		latestForTutor(locals.db, s.id),
		topicScores(locals.db, s.id, { weakFirst: true }),
		recentResults(locals.db, s.id, 10),
		schoolWork(locals.db, s.id)
	]);
	// what this tutor and student have done together (lessons, paid, homework, marks)
	const us = await together(locals.db, s.id, t);
	const link = (k: string | null, n: string | null) => (k ? fileLink(k, n ?? 'file') : null);
	return {
		student: s,
		together: us,
		now: new Date(),
		checkin,
		scores,
		results: results.map((r) => ({
			id: r.id,
			source: r.source,
			title: r.title,
			subject: r.subject,
			topic: r.topic,
			score: r.score,
			maxScore: r.maxScore,
			feedback: r.feedback,
			takenOn: r.takenOn,
			mine: r.tutorId === t
		})),
		school,
		lessons,
		balance,
		payments: payments.map((p) => ({
			...p,
			receipt: p.receiptNo ? receiptNumber(p.receiptNo) : null
		})),
		packages,
		currency: settings.currency,
		today: localDate(new Date()),
		homework: await Promise.all(
			homework.map(async (h) => ({
				...h,
				fileUrl: await link(h.fileKey, h.fileName),
				answers: await Promise.all(
					h.answers.map(async (a) => ({ ...a, fileUrl: await link(a.fileKey, a.fileName) }))
				)
			}))
		)
	};
};

const hwSchema = z.object({
	title: z.string().trim().min(2, 'err_required').max(120, 'err_too_long'),
	note: z.string().trim().max(2000, 'err_too_long').optional(),
	subject: z.string().trim().max(60, 'err_too_long').optional(),
	topic: z.string().trim().max(80, 'err_too_long').optional(),
	dueOn: z
		.string()
		.optional()
		.refine((v) => !v || isIsoDate(v), 'err_times')
});

const resultSchema = z.object({
	subject: z.string().trim().min(1, 'err_required').max(60, 'err_too_long'),
	topic: z.string().trim().min(1, 'err_required').max(80, 'err_too_long'),
	title: z.string().trim().max(120, 'err_too_long').optional(),
	score: z.coerce.number().int().min(0),
	maxScore: z.coerce.number().int().min(1).max(1000),
	feedback: z.string().trim().max(2000, 'err_too_long').optional(),
	takenOn: z
		.string()
		.optional()
		.refine((v) => !v || isIsoDate(v), 'err_times')
});

export const actions: Actions = {
	attendance: inboxActions.attendance,
	/** The tutor confirms the school details a student or parent entered. */
	checkSchool: async ({ locals, url, request, params }) => {
		const t = requireTutor(locals.user, url).id;
		const s = await student(locals.db, t, params.id);
		const id = Number(formObject(await request.formData()).id) || 0;
		const mine = (await schoolWork(locals.db, s.id)).subjects.some((x) => x.id === id);
		if (!mine || !(await checkSchoolSubject(locals.db, t, id)))
			return fail(404, { error: 'err_not_found' });
		return { done: 'school' };
	},
	/** A marked test or assessment: counts towards the student's progress on that topic. */
	result: async ({ locals, url, request, params }) => {
		const t = requireTutor(locals.user, url).id;
		const s = await student(locals.db, t, params.id);
		const p = resultSchema.safeParse(formObject(await request.formData()));
		if (!p.success) return fail(400, { error: p.error.issues[0].message, form: 'result' });
		if (p.data.score > p.data.maxScore)
			return fail(400, { error: 'tut3_err_score_max', form: 'result' });
		const today = localDate(new Date());
		if (p.data.takenOn && p.data.takenOn > today)
			return fail(400, { error: 'err_times', form: 'result' });
		await recordResult(locals.db, {
			studentId: s.id,
			tutorId: t,
			source: 'test',
			title: p.data.title || p.data.topic,
			subject: p.data.subject,
			topic: p.data.topic,
			score: p.data.score,
			maxScore: p.data.maxScore,
			feedback: p.data.feedback || null,
			takenOn: p.data.takenOn || today,
			createdBy: t
		});
		return { done: 'result' };
	},
	/** A note the student sees, after one of THIS tutor's lessons (checked in SQL). */
	lessonNote: async ({ locals, url, request, params }) => {
		const t = requireTutor(locals.user, url).id;
		const s = await student(locals.db, t, params.id);
		const f = formObject(await request.formData());
		const attendeeId = Number(f.attendeeId) || 0;
		const before = (await studentLessons(locals.db, t, s.id)).find(
			(l) => l.attendeeId === attendeeId
		);
		const text = f.text?.trim().slice(0, 2000) || null;
		if (!before || !(await setLessonFeedback(locals.db, t, s.id, attendeeId, text)))
			return fail(404, { error: 'err_not_found' });
		if (text && !before.feedback)
			await notifyUser(
				locals.db,
				s.id,
				m.tut3_email_lesson_note_s(),
				m.tut3_email_lesson_note_b({ when: fmtDay(before.startsAt) }),
				{ kind: 'lesson', link: `/student/lessons/${before.lessonId}` }
			);
		return { done: 'lessonNote' };
	},
	level: async ({ locals, url, request, params }) => {
		const t = requireTutor(locals.user, url).id;
		const s = await student(locals.db, t, params.id);
		const f = formObject(await request.formData());
		await setLevel(locals.db, t, s.id, f.level?.trim().slice(0, 60) || null);
		return { saved: true };
	},
	note: async ({ locals, url, request, params }) => {
		const t = requireTutor(locals.user, url).id;
		const s = await student(locals.db, t, params.id);
		const f = formObject(await request.formData());
		// only notes on this student's own lesson places
		const [a] = await locals.db
			.select()
			.from(attendee)
			.where(and(eq(attendee.id, Number(f.attendeeId) || 0), eq(attendee.userId, s.id)));
		if (!a) return fail(404, { error: 'err_not_found' });
		await setPrivateNote(locals.db, t, a.id, f.note?.trim().slice(0, 2000) || null);
		return { saved: true };
	},
	cash: async ({ locals, url, request, params }) => {
		const t = requireTutor(locals.user, url).id;
		const s = await student(locals.db, t, params.id);
		const f = formObject(await request.formData());
		const cents = parseMoney(f.amount ?? '');
		if (!cents) return fail(400, { error: 'err_money' });
		const date = isIsoDate(f.date ?? '') ? f.date : localDate(new Date());
		const r = await recordCash(locals.db, t, s.id, cents, date);
		await notifyUser(
			locals.db,
			s.id,
			m.email_cash_rec_s({ receipt: receiptNumber(r.receiptNo) }),
			m.email_cash_rec_b({ amount: formatMoney(cents, r.currency) })
		);
		return { saved: true, receipt: receiptNumber(r.receiptNo) };
	},
	homework: async ({ locals, url, request, params, platform }) => {
		const t = requireTutor(locals.user, url).id;
		const s = await student(locals.db, t, params.id);
		const data = await request.formData();
		const parsed = hwSchema.safeParse(formObject(data));
		if (!parsed.success) return fail(400, { error: 'err_required' });
		const file = await readUpload(data.get('file'), { maxBytes: 5 * MB, allowed: DOC_KINDS });
		if (file && !file.ok) return fail(400, { error: file.error });
		let fileKey: string | null = null;
		if (file?.ok) {
			fileKey = newKey(`homework/${s.id}`, file.ext);
			await getStore(platform).put(fileKey, file.bytes, file.kind);
		}
		await giveHomework(locals.db, t, {
			userId: s.id,
			title: parsed.data.title,
			note: parsed.data.note || null,
			dueOn: parsed.data.dueOn || null,
			subject: parsed.data.subject || null,
			topic: parsed.data.topic || null,
			fileKey,
			fileName: file?.ok ? file.name : null
		});
		await notifyUser(
			locals.db,
			s.id,
			m.email_hw_new_s(),
			m.email_hw_new_b({ title: parsed.data.title })
		);
		return { saved: true };
	},
	feedback: async ({ locals, url, request, params }) => {
		const t = requireTutor(locals.user, url).id;
		const s = await student(locals.db, t, params.id);
		const f = formObject(await request.formData());
		const hw = await homeworkForUser(locals.db, s.id, t);
		const answer = hw.flatMap((h) => h.answers).find((a) => a.id === Number(f.answerId));
		if (!answer) return fail(404, { error: 'err_not_found' });
		await giveFeedback(locals.db, t, answer.id, f.feedback?.trim().slice(0, 1000) || null);
		return { saved: true };
	}
};
