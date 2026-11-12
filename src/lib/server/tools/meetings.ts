/**
 * Meeting links for online lessons: Google Meet (Calendar API) or Microsoft Teams
 * (Graph onlineMeetings), depending on the tutor's choice in tool_pref.meetingTool.
 * Anything that fails returns null: the lesson then uses the Tutora low-data room, and
 * accepting a booking is never blocked.
 */
import { eq } from 'drizzle-orm';
import type { DB } from '../db/types.ts';
import { lesson, subject } from '../db/app.schema.ts';
import { lessonMeeting, toolPref, type MeetingTool } from '../db/v3.schema.ts';
import { TZ, TZ_OFFSET_MIN } from '../../tz.ts';
import { accessToken, G_CALENDAR, MS_MEETINGS } from './oauth.ts';

/** Server settings the Connected Tools need (OAuth app ids and the token-encryption key). */
export interface ToolsEnv {
	origin: string;
	secret: string;
	GOOGLE_CLIENT_ID?: string;
	GOOGLE_CLIENT_SECRET?: string;
	GOOGLE_API_KEY?: string;
	GOOGLE_APP_ID?: string;
	MS_CLIENT_ID?: string;
	MS_CLIENT_SECRET?: string;
	TOOLS_KEY?: string;
	/** for tests: replaces the global fetch for calls to Google and Microsoft */
	fetch?: typeof fetch;
}

export const CAL_EVENTS = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
export const GRAPH_MEETINGS = 'https://graph.microsoft.com/v1.0/me/onlineMeetings';

/** "2026-11-16T08:00:00+02:00": the instant in Zimbabwe time (UTC+2 all year). */
export function harareDateTime(d: Date): string {
	const x = new Date(d.getTime() + TZ_OFFSET_MIN * 60_000);
	const sign = TZ_OFFSET_MIN >= 0 ? '+' : '-';
	const off = Math.abs(TZ_OFFSET_MIN);
	const hh = String(Math.floor(off / 60)).padStart(2, '0');
	const mm = String(off % 60).padStart(2, '0');
	return `${x.toISOString().slice(0, 19)}${sign}${hh}:${mm}`;
}

/** The tutor's tool choices (defaults when they never chose). */
export async function getToolPref(db: DB, userId: string) {
	const [p] = await db.select().from(toolPref).where(eq(toolPref.userId, userId));
	return { meetingTool: (p?.meetingTool ?? 'room') as MeetingTool, kahootOn: p?.kahootOn ?? false };
}

export async function setToolPref(
	db: DB,
	userId: string,
	v: { meetingTool?: MeetingTool; kahootOn?: boolean }
) {
	const now = new Date();
	await db
		.insert(toolPref)
		.values({ userId, meetingTool: v.meetingTool ?? 'room', kahootOn: v.kahootOn ?? false })
		.onConflictDoUpdate({ target: toolPref.userId, set: { ...v, updatedAt: now } });
}

/** The meeting stored for a lesson, if any. */
export async function meetingFor(db: DB, lessonId: number) {
	const [m] = await db
		.select({ provider: lessonMeeting.provider, joinUrl: lessonMeeting.joinUrl })
		.from(lessonMeeting)
		.where(eq(lessonMeeting.lessonId, lessonId));
	return m ?? null;
}

const httpsOnly = (u: unknown): string | null => {
	if (typeof u !== 'string') return null;
	try {
		return new URL(u).protocol === 'https:' ? u : null;
	} catch {
		return null;
	}
};

async function createMeet(
	env: ToolsEnv,
	token: string,
	l: { id: number; startsAt: Date; endsAt: Date; subject: string | null }
): Promise<{ joinUrl: string; externalId: string } | null> {
	const f = env.fetch ?? fetch;
	const auth = { authorization: `Bearer ${token}` };
	// no attendees: children's email addresses are never sent to Google
	const res = await f(`${CAL_EVENTS}?conferenceDataVersion=1&sendUpdates=none`, {
		method: 'POST',
		headers: { ...auth, 'content-type': 'application/json' },
		body: JSON.stringify({
			summary: `Tutora lesson: ${l.subject ?? 'Lesson'}`,
			description: `Join from Tutora: ${env.origin}`,
			start: { dateTime: harareDateTime(l.startsAt), timeZone: TZ },
			end: { dateTime: harareDateTime(l.endsAt), timeZone: TZ },
			visibility: 'private',
			conferenceData: {
				createRequest: {
					requestId: `tutora-${l.id}-${crypto.randomUUID()}`,
					conferenceSolutionKey: { type: 'hangoutsMeet' }
				}
			}
		})
	});
	if (!res.ok) return null;
	const ev = (await res.json().catch(() => null)) as {
		id?: string;
		hangoutLink?: string;
		conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
	} | null;
	if (!ev?.id) return null;
	const link =
		httpsOnly(ev.hangoutLink) ??
		httpsOnly(ev.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri);
	if (link) return { joinUrl: link, externalId: ev.id };
	// the Meet is still being made: no link to give, so remove the empty event again
	await f(`${CAL_EVENTS}/${encodeURIComponent(ev.id)}?sendUpdates=none`, {
		method: 'DELETE',
		headers: auth
	}).catch(() => null);
	return null;
}

async function createTeams(
	env: ToolsEnv,
	token: string,
	l: { startsAt: Date; endsAt: Date; subject: string | null }
): Promise<{ joinUrl: string; externalId: string } | null> {
	const f = env.fetch ?? fetch;
	// personal Microsoft accounts cannot create meetings through Graph: that answers an error
	const res = await f(GRAPH_MEETINGS, {
		method: 'POST',
		headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
		body: JSON.stringify({
			startDateTime: l.startsAt.toISOString(),
			endDateTime: l.endsAt.toISOString(),
			subject: `Tutora lesson: ${l.subject ?? 'Lesson'}`
		})
	});
	if (!res.ok) return null;
	const j = (await res.json().catch(() => null)) as { id?: string; joinWebUrl?: string } | null;
	const link = httpsOnly(j?.joinWebUrl);
	return link && j?.id ? { joinUrl: link, externalId: j.id } : null;
}

/**
 * After a lesson is confirmed: if the tutor runs online lessons on Google Meet or Microsoft
 * Teams and has connected that account, create the meeting and store its join link.
 * Returns null when no tool is used (the low-data room is used instead) or creation fails;
 * a failure never blocks the booking.
 */
export async function createMeetingForLesson(
	db: DB,
	env: ToolsEnv,
	lessonId: number
): Promise<{ provider: 'meet' | 'teams'; joinUrl: string } | null> {
	try {
		const [l] = await db
			.select({
				id: lesson.id,
				tutorId: lesson.tutorId,
				mode: lesson.mode,
				status: lesson.status,
				startsAt: lesson.startsAt,
				endsAt: lesson.endsAt,
				subject: subject.name
			})
			.from(lesson)
			.leftJoin(subject, eq(subject.id, lesson.subjectId))
			.where(eq(lesson.id, lessonId));
		if (!l || l.mode !== 'online' || l.status !== 'scheduled') return null;
		const existing = await meetingFor(db, lessonId);
		if (existing) return existing;
		const pref = await getToolPref(db, l.tutorId);
		let made: { joinUrl: string; externalId: string } | null = null;
		let provider: 'meet' | 'teams';
		if (pref.meetingTool === 'meet') {
			provider = 'meet';
			const tok = await accessToken(db, env, l.tutorId, 'google', G_CALENDAR);
			if (tok) made = await createMeet(env, tok, l);
		} else if (pref.meetingTool === 'teams') {
			provider = 'teams';
			const tok = await accessToken(db, env, l.tutorId, 'microsoft', MS_MEETINGS);
			if (tok) made = await createTeams(env, tok, l);
		} else return null;
		if (!made) return null;
		const [row] = await db
			.insert(lessonMeeting)
			.values({ lessonId, provider, joinUrl: made.joinUrl, externalId: made.externalId })
			.onConflictDoNothing()
			.returning();
		if (!row) return meetingFor(db, lessonId);
		return { provider, joinUrl: made.joinUrl };
	} catch {
		// never log: errors may carry request details
		return null;
	}
}

/**
 * When a lesson is cancelled: delete the Meet calendar event or the Teams meeting (best
 * effort) and forget the link. Never throws.
 */
export async function cancelMeetingForLesson(db: DB, env: ToolsEnv, lessonId: number) {
	try {
		const [mt] = await db
			.select({
				provider: lessonMeeting.provider,
				externalId: lessonMeeting.externalId,
				tutorId: lesson.tutorId
			})
			.from(lessonMeeting)
			.innerJoin(lesson, eq(lesson.id, lessonMeeting.lessonId))
			.where(eq(lessonMeeting.lessonId, lessonId));
		if (!mt) return false;
		const f = env.fetch ?? fetch;
		if (mt.externalId) {
			if (mt.provider === 'meet') {
				const tok = await accessToken(db, env, mt.tutorId, 'google', G_CALENDAR);
				if (tok)
					await f(`${CAL_EVENTS}/${encodeURIComponent(mt.externalId)}?sendUpdates=none`, {
						method: 'DELETE',
						headers: { authorization: `Bearer ${tok}` }
					});
			} else {
				const tok = await accessToken(db, env, mt.tutorId, 'microsoft', MS_MEETINGS);
				if (tok)
					await f(`${GRAPH_MEETINGS}/${encodeURIComponent(mt.externalId)}`, {
						method: 'DELETE',
						headers: { authorization: `Bearer ${tok}` }
					});
			}
		}
		await db.delete(lessonMeeting).where(eq(lessonMeeting.lessonId, lessonId));
		return true;
	} catch {
		return false;
	}
}
