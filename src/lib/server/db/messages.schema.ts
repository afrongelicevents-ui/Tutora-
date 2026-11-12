/**
 * Messages between a student and a tutor they are enrolled with. Text only (no photos or
 * files). The parents connected to an under-18 student can read these conversations.
 */
import { index, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth.schema';

const ts = (name: string) => timestamp(name, { withTimezone: true });
const userRef = (name: string) =>
	text(name)
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' });

export const tutorMessage = pgTable(
	'tutor_message',
	{
		id: serial('id').primaryKey(),
		tutorId: userRef('tutor_id'),
		studentId: userRef('student_id'),
		/** the tutor or the student */
		fromId: userRef('from_id'),
		body: text('body').notNull(),
		readAt: ts('read_at'),
		createdAt: ts('created_at').notNull().defaultNow()
	},
	(t) => [index('tutor_message_pair').on(t.studentId, t.tutorId, t.createdAt)]
);
