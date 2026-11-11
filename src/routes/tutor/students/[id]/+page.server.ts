import { error, fail } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import {
	getStudent,
	giveFeedback,
	giveHomework,
	homeworkForUser,
	setLevel,
	setPrivateNote,
	studentLessons
} from '#lib/server/people.ts';
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
	const [lessons, balance, payments, packages, homework, settings] = await Promise.all([
		studentLessons(locals.db, t, s.id),
		balanceFor(locals.db, t, s.id),
		paymentsForUser(locals.db, s.id, t),
		packagesForUser(locals.db, s.id, t),
		homeworkForUser(locals.db, s.id, t),
		getSettings(locals.db, t)
	]);
	const link = (k: string | null, n: string | null) => (k ? fileLink(k, n ?? 'file') : null);
	return {
		student: s,
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
	dueOn: z
		.string()
		.optional()
		.refine((v) => !v || isIsoDate(v), 'err_times')
});

export const actions: Actions = {
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
