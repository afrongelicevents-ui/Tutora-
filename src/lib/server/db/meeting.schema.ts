import { index, integer, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth.schema';
import { lesson } from './app.schema';

export const MEETING_LINK_PROVIDERS = ['teams', 'meet', 'zoom'] as const;
export type MeetingLinkProvider = (typeof MEETING_LINK_PROVIDERS)[number];

/**
 * A tutor's own recurring meeting link (Teams, Google Meet or Zoom), pasted by the tutor: no
 * API keys. One per student (their one-to-one lessons) or one per group/class lesson.
 * Never one shared link for everybody: saving the same link for students who are not in the
 * same class shows the tutor a warning (meeting-links.ts).
 */
export const meetingLink = pgTable(
	'meeting_link',
	{
		id: serial('id').primaryKey(),
		tutorId: text('tutor_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		/** the student's one-to-one lessons with this tutor */
		studentId: text('student_id').references(() => user.id, { onDelete: 'cascade' }),
		/** a group/class lesson */
		lessonId: integer('lesson_id').references(() => lesson.id, { onDelete: 'cascade' }),
		provider: text('provider', { enum: MEETING_LINK_PROVIDERS }).notNull(),
		url: text('url').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('meeting_link_student_uq')
			.on(t.tutorId, t.studentId)
			.where(sql`${t.studentId} is not null`),
		uniqueIndex('meeting_link_lesson_uq')
			.on(t.lessonId)
			.where(sql`${t.lessonId} is not null`),
		index('meeting_link_url_idx').on(t.tutorId, t.url)
	]
);
