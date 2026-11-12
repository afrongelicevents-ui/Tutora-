/**
 * Lesson materials, revision resources and homework links (Drive files, kahoots, other
 * links). Every write checks ownership in the query: a tutor only touches their own lessons,
 * resources and homework; a student only their own answers.
 */
import { and, asc, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { DB } from './db/types.ts';
import { user } from './db/auth.schema.ts';
import { attendee, enrollment, homework, homeworkAnswer, lesson } from './db/app.schema.ts';
import { homeworkLink, lessonMaterial, MATERIAL_KINDS, resource } from './db/v3.schema.ts';

export type MaterialKind = (typeof MATERIAL_KINDS)[number];

export class MaterialFail extends Error {
	constructor(public code: string) {
		super(code);
	}
}

const KAHOOT_HOSTS = ['kahoot.it', 'kahoot.com'];
const DRIVE_HOSTS = ['drive.google.com', 'docs.google.com'];
const onHost = (host: string, roots: string[]) =>
	roots.some((r) => host === r || host.endsWith('.' + r));

/**
 * A safe https link for this kind, or a MaterialFail. Kahoot! links must be on kahoot.it or
 * kahoot.com (e.g. create.kahoot.it, play.kahoot.it); Drive links on Google Drive / Docs.
 */
export function checkUrl(kind: MaterialKind, raw: string | null | undefined): string {
	const v = (raw ?? '').trim();
	if (!v || v.length > 2000) throw new MaterialFail('tools6_err_url');
	let u: URL;
	try {
		u = new URL(v);
	} catch {
		throw new MaterialFail('tools6_err_url');
	}
	if (u.protocol !== 'https:' || u.username || u.password)
		throw new MaterialFail('tools6_err_https');
	const host = u.hostname.toLowerCase();
	if (kind === 'kahoot' && !onHost(host, KAHOOT_HOSTS))
		throw new MaterialFail('tools6_err_kahoot_url');
	if (kind === 'drive' && !onHost(host, DRIVE_HOSTS)) throw new MaterialFail('tools6_err_url');
	return u.toString();
}

export interface NewMaterial {
	kind: MaterialKind;
	title: string;
	url?: string | null;
	driveFileId?: string | null;
	fileKey?: string | null;
}

function clean(m: NewMaterial) {
	if (!(MATERIAL_KINDS as readonly string[]).includes(m.kind))
		throw new MaterialFail('tools6_err_kind');
	const title = m.title.trim().replace(/\s+/g, ' ').slice(0, 160);
	if (!title) throw new MaterialFail('tools6_err_title');
	if (m.kind === 'file') {
		if (!m.fileKey) throw new MaterialFail('tools6_err_kind');
		return { kind: m.kind, title, url: null, driveFileId: null, fileKey: m.fileKey };
	}
	const url = checkUrl(m.kind, m.url);
	const driveFileId = m.kind === 'drive' ? (m.driveFileId ?? null) : null;
	return { kind: m.kind, title, url, driveFileId, fileKey: null };
}

/* ------------------------------------------------------------------ lesson materials */

async function ownLesson(db: DB, tutorId: string, lessonId: number) {
	const [l] = await db
		.select({ id: lesson.id })
		.from(lesson)
		.where(and(eq(lesson.id, lessonId), eq(lesson.tutorId, tutorId)));
	if (!l) throw new MaterialFail('err_not_found');
}

export async function addLessonMaterial(db: DB, tutorId: string, lessonId: number, m: NewMaterial) {
	await ownLesson(db, tutorId, lessonId);
	const v = clean(m);
	const [row] = await db
		.insert(lessonMaterial)
		.values({ lessonId, tutorId, ...v })
		.returning();
	return row;
}

export async function removeLessonMaterial(db: DB, tutorId: string, lessonId: number, id: number) {
	const r = await db
		.delete(lessonMaterial)
		.where(
			and(
				eq(lessonMaterial.id, id),
				eq(lessonMaterial.lessonId, lessonId),
				eq(lessonMaterial.tutorId, tutorId)
			)
		)
		.returning({ id: lessonMaterial.id });
	return r.length > 0;
}

const materialFields = {
	id: lessonMaterial.id,
	kind: lessonMaterial.kind,
	title: lessonMaterial.title,
	url: lessonMaterial.url,
	driveFileId: lessonMaterial.driveFileId,
	fileKey: lessonMaterial.fileKey
};

/** The materials of a lesson the tutor teaches. */
export function lessonMaterialsForTutor(db: DB, tutorId: string, lessonId: number) {
	return db
		.select(materialFields)
		.from(lessonMaterial)
		.where(and(eq(lessonMaterial.lessonId, lessonId), eq(lessonMaterial.tutorId, tutorId)))
		.orderBy(asc(lessonMaterial.id));
}

/** The materials of a lesson the student is booked on (empty otherwise). */
export function lessonMaterialsForStudent(db: DB, studentId: string, lessonId: number) {
	return db
		.select(materialFields)
		.from(lessonMaterial)
		.innerJoin(
			attendee,
			and(
				eq(attendee.lessonId, lessonMaterial.lessonId),
				eq(attendee.userId, studentId),
				eq(attendee.status, 'booked')
			)
		)
		.where(eq(lessonMaterial.lessonId, lessonId))
		.orderBy(asc(lessonMaterial.id));
}

/** Email addresses of the students booked on a tutor's lesson (to share a Drive file). */
export async function lessonStudentEmails(db: DB, tutorId: string, lessonId: number) {
	const rows = await db
		.select({ email: user.email })
		.from(attendee)
		.innerJoin(lesson, eq(lesson.id, attendee.lessonId))
		.innerJoin(user, eq(user.id, attendee.userId))
		.where(
			and(
				eq(attendee.lessonId, lessonId),
				eq(lesson.tutorId, tutorId),
				eq(attendee.status, 'booked')
			)
		);
	return rows.map((r) => r.email);
}

/* ------------------------------------------------------------------ revision resources */

async function isEnrolled(db: DB, tutorId: string, studentId: string) {
	const [e] = await db
		.select({ u: enrollment.userId })
		.from(enrollment)
		.where(and(eq(enrollment.tutorId, tutorId), eq(enrollment.userId, studentId)));
	return !!e;
}

export interface NewResource extends NewMaterial {
	subject: string;
	level?: string | null;
	/** null: all of this tutor's students */
	studentId?: string | null;
}

export async function addResource(db: DB, tutorId: string, r: NewResource) {
	const subject = r.subject.trim().slice(0, 60);
	if (!subject) throw new MaterialFail('tools6_err_subject');
	if (r.studentId && !(await isEnrolled(db, tutorId, r.studentId)))
		throw new MaterialFail('err_not_found');
	const v = clean(r);
	const [row] = await db
		.insert(resource)
		.values({
			tutorId,
			studentId: r.studentId || null,
			subject,
			level: r.level?.trim().slice(0, 40) || null,
			...v
		})
		.returning();
	return row;
}

export async function removeResource(db: DB, tutorId: string, id: number) {
	const r = await db
		.delete(resource)
		.where(and(eq(resource.id, id), eq(resource.tutorId, tutorId)))
		.returning({ id: resource.id });
	return r.length > 0;
}

export function resourcesForTutor(db: DB, tutorId: string) {
	return db
		.select({
			id: resource.id,
			subject: resource.subject,
			level: resource.level,
			kind: resource.kind,
			title: resource.title,
			url: resource.url,
			driveFileId: resource.driveFileId,
			studentId: resource.studentId,
			studentName: user.name
		})
		.from(resource)
		.leftJoin(user, eq(user.id, resource.studentId))
		.where(eq(resource.tutorId, tutorId))
		.orderBy(asc(resource.subject), desc(resource.id));
}

/** Resources a student can see: their own, and "all students" ones of their tutors. */
export async function resourcesForStudent(db: DB, studentId: string, subject?: string) {
	const tutors = await db
		.select({ t: enrollment.tutorId })
		.from(enrollment)
		.where(eq(enrollment.userId, studentId));
	const tutorIds = tutors.map((t) => t.t);
	if (tutorIds.length === 0) return [];
	return db
		.select({
			id: resource.id,
			subject: resource.subject,
			level: resource.level,
			kind: resource.kind,
			title: resource.title,
			url: resource.url,
			driveFileId: resource.driveFileId,
			fileKey: resource.fileKey
		})
		.from(resource)
		.where(
			and(
				inArray(resource.tutorId, tutorIds),
				or(eq(resource.studentId, studentId), isNull(resource.studentId)),
				subject ? eq(resource.subject, subject) : undefined
			)
		)
		.orderBy(asc(resource.subject), desc(resource.id));
}

/* ------------------------------------------------------------------ homework links */

const linkFields = {
	id: homeworkLink.id,
	kind: homeworkLink.kind,
	title: homeworkLink.title,
	url: homeworkLink.url,
	driveFileId: homeworkLink.driveFileId
};

/** Tutor attaches a file or link to homework they set. Returns the student's email. */
export async function addHomeworkLink(db: DB, tutorId: string, homeworkId: number, m: NewMaterial) {
	const [h] = await db
		.select({ id: homework.id, email: user.email })
		.from(homework)
		.innerJoin(user, eq(user.id, homework.userId))
		.where(and(eq(homework.id, homeworkId), eq(homework.tutorId, tutorId)));
	if (!h) throw new MaterialFail('err_not_found');
	const v = clean(m);
	if (v.kind === 'file') throw new MaterialFail('tools6_err_kind');
	const [row] = await db
		.insert(homeworkLink)
		.values({ homeworkId, kind: v.kind, title: v.title, url: v.url, driveFileId: v.driveFileId })
		.returning();
	return { link: row, studentEmail: h.email };
}

/** Student attaches a file or link to their own handed-in answer. Returns the tutor's email. */
export async function addAnswerLink(db: DB, studentId: string, answerId: number, m: NewMaterial) {
	const [a] = await db
		.select({ id: homeworkAnswer.id, email: user.email })
		.from(homeworkAnswer)
		.innerJoin(homework, eq(homework.id, homeworkAnswer.homeworkId))
		.innerJoin(user, eq(user.id, homework.tutorId))
		.where(and(eq(homeworkAnswer.id, answerId), eq(homework.userId, studentId)));
	if (!a) throw new MaterialFail('err_not_found');
	const v = clean(m);
	if (v.kind === 'file') throw new MaterialFail('tools6_err_kind');
	const [row] = await db
		.insert(homeworkLink)
		.values({ answerId, kind: v.kind, title: v.title, url: v.url, driveFileId: v.driveFileId })
		.returning();
	return { link: row, tutorEmail: a.email };
}

/** Links on homework, for the tutor who set it or the student it is for. */
export function homeworkLinks(db: DB, viewerId: string, homeworkId: number) {
	return db
		.select(linkFields)
		.from(homeworkLink)
		.innerJoin(homework, eq(homework.id, homeworkLink.homeworkId))
		.where(
			and(
				eq(homeworkLink.homeworkId, homeworkId),
				or(eq(homework.tutorId, viewerId), eq(homework.userId, viewerId))
			)
		)
		.orderBy(asc(homeworkLink.id));
}

/** Links on a handed-in answer, for its student or the tutor who set the homework. */
export function answerLinks(db: DB, viewerId: string, answerId: number) {
	return db
		.select(linkFields)
		.from(homeworkLink)
		.innerJoin(homeworkAnswer, eq(homeworkAnswer.id, homeworkLink.answerId))
		.innerJoin(homework, eq(homework.id, homeworkAnswer.homeworkId))
		.where(
			and(
				eq(homeworkLink.answerId, answerId),
				or(eq(homework.tutorId, viewerId), eq(homework.userId, viewerId))
			)
		)
		.orderBy(asc(homeworkLink.id));
}

const answerHomework = alias(homework, 'answer_homework');

/** Remove a homework link: the tutor (homework links) or the student (answer links). */
export async function removeHomeworkLink(db: DB, userId: string, id: number) {
	const [l] = await db
		.select({
			id: homeworkLink.id,
			hwTutor: homework.tutorId,
			ansStudent: answerHomework.userId
		})
		.from(homeworkLink)
		.leftJoin(homework, eq(homework.id, homeworkLink.homeworkId))
		.leftJoin(homeworkAnswer, eq(homeworkAnswer.id, homeworkLink.answerId))
		.leftJoin(answerHomework, eq(answerHomework.id, homeworkAnswer.homeworkId))
		.where(eq(homeworkLink.id, id));
	if (!l || (l.hwTutor !== userId && l.ansStudent !== userId)) return false;
	await db.delete(homeworkLink).where(eq(homeworkLink.id, id));
	return true;
}
