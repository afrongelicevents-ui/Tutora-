import { and, asc, eq, gt, lt } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { calendarEvent } from './db/app.schema.ts';

export const eventsBetween = (db: DB, tutorId: string, from: Date, to: Date) =>
	db
		.select()
		.from(calendarEvent)
		.where(
			and(
				eq(calendarEvent.tutorId, tutorId),
				lt(calendarEvent.startsAt, to),
				gt(calendarEvent.endsAt, from)
			)
		)
		.orderBy(asc(calendarEvent.startsAt));

export async function addEvent(
	db: DB,
	tutorId: string,
	v: { title: string; startsAt: Date; endsAt: Date; note: string | null }
) {
	const [row] = await db
		.insert(calendarEvent)
		.values({ ...v, tutorId })
		.returning();
	return row;
}

export async function removeEvent(db: DB, tutorId: string, id: number) {
	await db
		.delete(calendarEvent)
		.where(and(eq(calendarEvent.id, id), eq(calendarEvent.tutorId, tutorId)));
}

/** iCalendar text for one lesson, so it can be added to the phone's calendar. */
export function lessonIcs(
	l: { id: number; startsAt: Date; endsAt: Date; title: string; description: string; url: string },
	host: string
) {
	const f = (d: Date) =>
		d
			.toISOString()
			.replace(/[-:]/g, '')
			.replace(/\.\d{3}/, '');
	const escape = (s: string) =>
		s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
	return [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Tutora//Lessons//EN',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		'BEGIN:VEVENT',
		`UID:lesson-${l.id}@${host}`,
		`DTSTAMP:${f(new Date())}`,
		`DTSTART:${f(l.startsAt)}`,
		`DTEND:${f(l.endsAt)}`,
		`SUMMARY:${escape(l.title)}`,
		`DESCRIPTION:${escape(l.description)}`,
		`URL:${l.url}`,
		'BEGIN:VALARM',
		'TRIGGER:-PT1H',
		'ACTION:DISPLAY',
		`DESCRIPTION:${escape(l.title)}`,
		'END:VALARM',
		'END:VEVENT',
		'END:VCALENDAR',
		''
	].join('\r\n');
}
