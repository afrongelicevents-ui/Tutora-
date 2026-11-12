import { fail } from '@sveltejs/kit';
import { and, asc, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { requireTutor } from '#lib/server/guards.ts';
import { subject } from '#lib/server/db/app.schema.ts';
import {
	bestMatch,
	MAX_REPORT_BYTES,
	parseKahootReport,
	ReportFail
} from '#lib/server/tools/kahoot.ts';
import { ownStudents, recordKahootScores } from '#lib/server/tools/kahoot-import.ts';
import { formObject } from '#lib/validation/auth.ts';
import { localDate } from '#lib/tz.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	const t = requireTutor(locals.user, url).id;
	const [students, subjects] = await Promise.all([
		ownStudents(locals.db, t),
		locals.db
			.select({ name: subject.name })
			.from(subject)
			.where(and(eq(subject.tutorId, t), eq(subject.active, true)))
			.orderBy(asc(subject.sortOrder))
	]);
	return {
		students,
		subjects: [...new Set(subjects.map((s: { name: string }) => s.name))],
		today: localDate(new Date())
	};
};

const int = (v: string | undefined) => {
	const n = Number(v);
	return Number.isInteger(n) ? n : NaN;
};

export const actions: Actions = {
	/** read the uploaded report; nothing is saved yet */
	parse: async ({ locals, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		const fd = await request.formData();
		const file = fd.get('report');
		if (!(file instanceof File) || file.size === 0)
			return fail(400, { error: 'tools6_err_report_empty' });
		if (file.size > MAX_REPORT_BYTES) return fail(400, { error: 'tools6_err_report_big' });
		try {
			const scores = await parseKahootReport(new Uint8Array(await file.arrayBuffer()));
			const students = await ownStudents(locals.db, t);
			return {
				players: scores.map((s) => ({ ...s, match: bestMatch(s.player, students) ?? '' })),
				fileName: file.name.slice(0, 120)
			};
		} catch (e) {
			if (e instanceof ReportFail) return fail(400, { error: e.code });
			return fail(400, { error: 'tools6_err_report_format' });
		}
	},
	/** save the matched players as results */
	save: async ({ locals, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		const f = formObject(await request.formData());
		const n = Math.min(500, Math.max(0, int(f.count) || 0));
		const rows: { studentId: string; correct: number; incorrect: number }[] = [];
		for (let i = 0; i < n; i++) {
			const sid = f[`student_${i}`];
			if (!sid) continue;
			rows.push({
				studentId: sid,
				correct: int(f[`correct_${i}`]),
				incorrect: int(f[`incorrect_${i}`])
			});
		}
		if (!rows.length) return fail(400, { error: 'tools6_err_kahoot_none' });
		if (new Set(rows.map((r) => r.studentId)).size !== rows.length)
			return fail(400, { error: 'tools6_err_kahoot_twice' });
		if (!f.subject?.trim() || !f.topic?.trim() || !f.title?.trim())
			return fail(400, { error: 'tools6_err_kahoot_fields' });
		const r = await recordKahootScores(locals.db, t, {
			subject: f.subject,
			topic: f.topic,
			title: f.title,
			takenOn: f.takenOn,
			rows
		});
		return { savedCount: r.saved, skippedCount: r.skipped };
	},
	/** one score typed in by hand */
	manual: async ({ locals, url, request }) => {
		const t = requireTutor(locals.user, url).id;
		const f = formObject(await request.formData());
		const correct = int(f.correct);
		const total = int(f.total);
		if (!(total > 0 && correct >= 0 && correct <= total))
			return fail(400, { error: 'tools6_err_score' });
		if (!f.subject?.trim() || !f.topic?.trim() || !f.title?.trim())
			return fail(400, { error: 'tools6_err_kahoot_fields' });
		const r = await recordKahootScores(locals.db, t, {
			subject: f.subject,
			topic: f.topic,
			title: f.title,
			takenOn: f.takenOn,
			rows: [{ studentId: f.studentId ?? '', correct, incorrect: total - correct }]
		});
		if (!r.saved) return fail(400, { error: 'err_not_found' });
		return { savedCount: 1, skippedCount: 0 };
	}
};
