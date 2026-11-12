/**
 * Saving Kahoot! scores as results (source 'kahoot'): from an uploaded report, after the
 * tutor matched each player to one of their own students, or typed in by hand.
 * score = correct answers, maxScore = correct + incorrect.
 */
import { and, asc, eq } from 'drizzle-orm';
import type { DB } from '../db/types.ts';
import { user } from '../db/auth.schema.ts';
import { enrollment } from '../db/app.schema.ts';
import { recordResult } from '../progress.ts';
import { isIsoDate } from '../../tz.ts';

/** The tutor's own students (only these can get a score). */
export function ownStudents(db: DB, tutorId: string) {
	return db
		.select({ id: user.id, name: user.name })
		.from(enrollment)
		.innerJoin(user, eq(user.id, enrollment.userId))
		.where(and(eq(enrollment.tutorId, tutorId), eq(user.role, 'student')))
		.orderBy(asc(user.name));
}

export interface KahootImport {
	subject: string;
	topic: string;
	title: string;
	takenOn?: string;
	rows: { studentId: string; correct: number; incorrect: number }[];
}

const MAX_ANSWERS = 1000;

export async function recordKahootScores(db: DB, tutorId: string, k: KahootImport) {
	const subject = k.subject.trim();
	const topic = k.topic.trim();
	const title = k.title.trim();
	if (!subject || !topic || !title) throw new Error('tools6_err_kahoot_fields');
	const takenOn = k.takenOn && isIsoDate(k.takenOn) ? k.takenOn : undefined;
	const mine = new Set((await ownStudents(db, tutorId)).map((s) => s.id));
	let saved = 0;
	let skipped = 0;
	for (const r of k.rows) {
		const c = Math.round(r.correct);
		const i = Math.round(r.incorrect);
		const ok =
			mine.has(r.studentId) &&
			Number.isFinite(c) &&
			Number.isFinite(i) &&
			c >= 0 &&
			i >= 0 &&
			c + i > 0 &&
			c + i <= MAX_ANSWERS;
		if (!ok) {
			skipped++;
			continue;
		}
		await recordResult(db, {
			studentId: r.studentId,
			tutorId,
			source: 'kahoot',
			title,
			subject,
			topic,
			score: c,
			maxScore: c + i,
			takenOn,
			createdBy: tutorId
		});
		saved++;
	}
	return { saved, skipped };
}
