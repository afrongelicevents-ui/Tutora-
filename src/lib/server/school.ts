/**
 * "My school work": school, year, and per subject the syllabus, textbook and what class is on
 * now. Entered by the student or a parent, checked by a tutor. Never invented: empty until
 * someone enters it, and any edit clears the tutor's check.
 */
import { and, asc, eq } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { schoolInfo, schoolSubject } from './db/v3.schema.ts';
import { enrollment } from './db/app.schema.ts';
import { user } from './db/auth.schema.ts';

const clean = (v: string | null | undefined, max = 120) => {
	const t = (v ?? '').trim().slice(0, max);
	return t || null;
};

export async function schoolWork(db: DB, studentId: string) {
	const [info] = await db.select().from(schoolInfo).where(eq(schoolInfo.studentId, studentId));
	const subjects = await db
		.select({
			id: schoolSubject.id,
			subject: schoolSubject.subject,
			syllabus: schoolSubject.syllabus,
			textbook: schoolSubject.textbook,
			currentTopic: schoolSubject.currentTopic,
			checkedAt: schoolSubject.checkedAt,
			checkedByName: user.name,
			updatedAt: schoolSubject.updatedAt
		})
		.from(schoolSubject)
		.leftJoin(user, eq(user.id, schoolSubject.checkedBy))
		.where(eq(schoolSubject.studentId, studentId))
		.orderBy(asc(schoolSubject.subject));
	return { school: info?.school ?? null, year: info?.year ?? null, subjects };
}

export async function saveSchoolInfo(
	db: DB,
	studentId: string,
	by: string,
	v: { school?: string | null; year?: string | null }
) {
	const values = {
		school: clean(v.school),
		year: clean(v.year, 40),
		enteredBy: by,
		updatedAt: new Date()
	};
	await db
		.insert(schoolInfo)
		.values({ studentId, ...values })
		.onConflictDoUpdate({ target: schoolInfo.studentId, set: values });
}

/** Add or change one subject (id null = new). Any change needs the tutor to check it again. */
export async function saveSchoolSubject(
	db: DB,
	studentId: string,
	by: string,
	id: number | null,
	v: {
		subject: string;
		syllabus?: string | null;
		textbook?: string | null;
		currentTopic?: string | null;
	}
) {
	const subject = clean(v.subject, 60);
	if (!subject) return null;
	const values = {
		subject,
		syllabus: clean(v.syllabus),
		textbook: clean(v.textbook),
		currentTopic: clean(v.currentTopic),
		enteredBy: by,
		checkedBy: null,
		checkedAt: null,
		updatedAt: new Date()
	};
	if (id) {
		const [row] = await db
			.update(schoolSubject)
			.set(values)
			.where(and(eq(schoolSubject.id, id), eq(schoolSubject.studentId, studentId)))
			.returning();
		return row ?? null;
	}
	const [row] = await db
		.insert(schoolSubject)
		.values({ studentId, ...values })
		.returning();
	return row;
}

export async function removeSchoolSubject(db: DB, studentId: string, id: number) {
	await db
		.delete(schoolSubject)
		.where(and(eq(schoolSubject.id, id), eq(schoolSubject.studentId, studentId)));
}

/** A tutor confirms a subject's details, only for a student they actually teach. */
export async function checkSchoolSubject(db: DB, tutorId: string, id: number) {
	const [row] = await db
		.select({ studentId: schoolSubject.studentId })
		.from(schoolSubject)
		.innerJoin(
			enrollment,
			and(eq(enrollment.userId, schoolSubject.studentId), eq(enrollment.tutorId, tutorId))
		)
		.where(eq(schoolSubject.id, id));
	if (!row) return false;
	await db
		.update(schoolSubject)
		.set({ checkedBy: tutorId, checkedAt: new Date() })
		.where(eq(schoolSubject.id, id));
	return true;
}
