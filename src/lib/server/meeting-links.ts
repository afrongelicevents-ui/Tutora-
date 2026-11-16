/**
 * Meeting links the tutor pastes (Teams, Google Meet, Zoom): no API keys, no accounts.
 * One recurring link per student (their one-to-one lessons) or per group/class lesson.
 * Every lesson then shows "Join lesson" for the child and the tutor; without a link (or when
 * the tutor prefers it) Tutora's own low-data lesson room is used.
 */
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { user } from './db/auth.schema.ts';
import { attendee, lesson } from './db/app.schema.ts';
import { lessonMeeting } from './db/v3.schema.ts';
import { meetingLink, type MeetingLinkProvider } from './db/meeting.schema.ts';

export type JoinProvider = MeetingLinkProvider;
export interface JoinLink {
	provider: JoinProvider;
	url: string;
	/** 'lesson': made for this lesson (Meet/Teams connection); 'student' / 'class': pasted */
	from: 'lesson' | 'student' | 'class';
}

export type LinkCheck =
	| { ok: true; provider: MeetingLinkProvider; url: string }
	| { ok: false; error: 'ml_err_empty' | 'ml_err_https' | 'ml_err_kind' };

const MEET_CODE = /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}\/?$/;

/** Is this a real Teams, Google Meet or Zoom meeting link (https only)? */
export function checkMeetingLink(raw: string | null | undefined): LinkCheck {
	const v = (raw ?? '').trim();
	if (!v) return { ok: false, error: 'ml_err_empty' };
	let u: URL;
	try {
		u = new URL(v);
	} catch {
		return { ok: false, error: 'ml_err_kind' };
	}
	if (u.protocol !== 'https:') return { ok: false, error: 'ml_err_https' };
	if (u.username || u.password || (u.port && u.port !== '443'))
		return { ok: false, error: 'ml_err_kind' };
	const host = u.hostname.toLowerCase();
	const path = u.pathname;
	// Google Meet: meet.google.com/abc-defg-hij
	if (host === 'meet.google.com' && MEET_CODE.test(path))
		return { ok: true, provider: 'meet', url: `https://meet.google.com${path.replace(/\/$/, '')}` };
	// Microsoft Teams: work/school meeting links and Teams (free) meeting links
	if (
		(host === 'teams.microsoft.com' && path.startsWith('/l/meetup-join/') && path.length > 16) ||
		(host === 'teams.live.com' && /^\/meet\/\d{6,}/.test(path))
	)
		return { ok: true, provider: 'teams', url: u.toString() };
	// Zoom: zoom.us/j/123…, company.zoom.us/j/123…, zoom.us/my/name
	if (
		(host === 'zoom.us' || host.endsWith('.zoom.us')) &&
		(/^\/j\/\d{9,12}\/?$/.test(path) || /^\/my\/[a-z0-9._-]{3,40}\/?$/i.test(path))
	)
		return { ok: true, provider: 'zoom', url: u.toString() };
	return { ok: false, error: 'ml_err_kind' };
}

/** Students of this tutor already using this exact link (for the "never one link for all" warning). */
async function othersWithUrl(db: DB, tutorId: string, url: string, exceptStudent: string) {
	return db
		.select({ studentId: meetingLink.studentId, name: user.name })
		.from(meetingLink)
		.innerJoin(user, eq(user.id, meetingLink.studentId))
		.where(
			and(
				eq(meetingLink.tutorId, tutorId),
				eq(meetingLink.url, url),
				ne(meetingLink.studentId, exceptStudent)
			)
		);
}

/** Students who share at least one group/class lesson with `studentId` (same tutor). */
async function classmates(db: DB, tutorId: string, studentId: string) {
	const rows = await db.execute(sql`
		select distinct b.user_id as id
		from ${attendee} a
		join ${lesson} l on l.id = a.lesson_id
		join ${attendee} b on b.lesson_id = l.id and b.user_id <> a.user_id
		where a.user_id = ${studentId} and l.tutor_id = ${tutorId} and l.capacity > 1
		  and a.status = 'booked' and b.status = 'booked'`);
	const list =
		(rows as unknown as { rows?: { id: string }[] }).rows ?? (rows as unknown as { id: string }[]);
	return new Set(list.map((r) => r.id));
}

export type SaveResult =
	{ ok: true; provider: MeetingLinkProvider; sharedWith: string[] } | { ok: false; error: string };

/**
 * Save (or replace) the tutor's link for one student. `sharedWith` lists other students who
 * already have the same link and are NOT in a class with this student: the tutor is warned,
 * because one link for everybody lets students walk into each other's lessons.
 */
export async function saveStudentLink(
	db: DB,
	tutorId: string,
	studentId: string,
	raw: string
): Promise<SaveResult> {
	const c = checkMeetingLink(raw);
	if (!c.ok) return c;
	const now = new Date();
	await db
		.insert(meetingLink)
		.values({ tutorId, studentId, provider: c.provider, url: c.url })
		.onConflictDoUpdate({
			target: [meetingLink.tutorId, meetingLink.studentId],
			targetWhere: sql`${meetingLink.studentId} is not null`,
			set: { provider: c.provider, url: c.url, updatedAt: now }
		});
	const [others, mates] = await Promise.all([
		othersWithUrl(db, tutorId, c.url, studentId),
		classmates(db, tutorId, studentId)
	]);
	const sharedWith = others
		.filter((o) => o.studentId && !mates.has(o.studentId))
		.map((o) => o.name);
	return { ok: true, provider: c.provider, sharedWith };
}

/** Save (or replace) the link for one group/class lesson of this tutor. */
export async function saveLessonLink(
	db: DB,
	tutorId: string,
	lessonId: number,
	raw: string
): Promise<SaveResult> {
	const c = checkMeetingLink(raw);
	if (!c.ok) return c;
	const [own] = await db
		.select({ id: lesson.id })
		.from(lesson)
		.where(and(eq(lesson.id, lessonId), eq(lesson.tutorId, tutorId)));
	if (!own) return { ok: false, error: 'err_not_found' };
	await db
		.insert(meetingLink)
		.values({ tutorId, lessonId, provider: c.provider, url: c.url })
		.onConflictDoUpdate({
			target: meetingLink.lessonId,
			targetWhere: sql`${meetingLink.lessonId} is not null`,
			set: { provider: c.provider, url: c.url, updatedAt: new Date() }
		});
	return { ok: true, provider: c.provider, sharedWith: [] };
}

/** Remove a pasted link: lessons then use Tutora's low-data lesson room. */
export async function removeStudentLink(db: DB, tutorId: string, studentId: string) {
	await db
		.delete(meetingLink)
		.where(and(eq(meetingLink.tutorId, tutorId), eq(meetingLink.studentId, studentId)));
}

export async function removeLessonLink(db: DB, tutorId: string, lessonId: number) {
	await db
		.delete(meetingLink)
		.where(and(eq(meetingLink.tutorId, tutorId), eq(meetingLink.lessonId, lessonId)));
}

export async function studentLink(db: DB, tutorId: string, studentId: string) {
	const [r] = await db
		.select({ provider: meetingLink.provider, url: meetingLink.url })
		.from(meetingLink)
		.where(and(eq(meetingLink.tutorId, tutorId), eq(meetingLink.studentId, studentId)));
	return r ?? null;
}

export async function lessonLink(db: DB, lessonId: number) {
	const [r] = await db
		.select({ provider: meetingLink.provider, url: meetingLink.url })
		.from(meetingLink)
		.where(eq(meetingLink.lessonId, lessonId));
	return r ?? null;
}

export interface JoinQuery {
	lessonId: number;
	tutorId: string;
	/** booked students; one = a one-to-one lesson (their own link applies) */
	studentIds: string[];
	/** a group/class lesson */
	group?: boolean;
}

/**
 * How to join each lesson, in this order: the meeting made for that lesson (Meet/Teams
 * connection), the class link (group lessons), the student's own link (one-to-one lessons).
 * Lessons without any get no entry: Tutora's lesson room is used. Two small queries in all.
 */
export async function joinLinks(db: DB, qs: JoinQuery[]): Promise<Map<number, JoinLink>> {
	const out = new Map<number, JoinLink>();
	if (!qs.length) return out;
	const ids = qs.map((q) => q.lessonId);
	const pairs = qs.filter((q) => !q.group && q.studentIds.length === 1);
	const [made, pasted] = await Promise.all([
		db
			.select({
				id: lessonMeeting.lessonId,
				provider: lessonMeeting.provider,
				url: lessonMeeting.joinUrl
			})
			.from(lessonMeeting)
			.where(inArray(lessonMeeting.lessonId, ids)),
		db
			.select({
				tutorId: meetingLink.tutorId,
				studentId: meetingLink.studentId,
				lessonId: meetingLink.lessonId,
				provider: meetingLink.provider,
				url: meetingLink.url
			})
			.from(meetingLink)
			.where(
				sql`${inArray(meetingLink.lessonId, ids)} or (${meetingLink.studentId} is not null and ${inArray(
					meetingLink.tutorId,
					pairs.length ? [...new Set(pairs.map((p) => p.tutorId))] : ['']
				)} and ${inArray(
					meetingLink.studentId,
					pairs.length ? [...new Set(pairs.map((p) => p.studentIds[0]))] : ['']
				)})`
			)
	]);
	const httpsUrl = (u: string) => u.startsWith('https://');
	for (const m of made)
		if (httpsUrl(m.url)) out.set(m.id, { provider: m.provider, url: m.url, from: 'lesson' });
	for (const q of qs) {
		if (out.has(q.lessonId)) continue;
		const cls = pasted.find((p) => p.lessonId === q.lessonId);
		if (cls) {
			out.set(q.lessonId, { provider: cls.provider, url: cls.url, from: 'class' });
			continue;
		}
		if (q.group || q.studentIds.length !== 1) continue;
		const own = pasted.find((p) => p.tutorId === q.tutorId && p.studentId === q.studentIds[0]);
		if (own) out.set(q.lessonId, { provider: own.provider, url: own.url, from: 'student' });
	}
	return out;
}
