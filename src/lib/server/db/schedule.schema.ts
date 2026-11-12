/**
 * The student's personal timetable: school, meals, breaks, time with friends, sport, chores,
 * sleep and so on. Study time comes from the study plan (study_plan_item) and is shown with it.
 */
import {
	boolean,
	check,
	index,
	integer,
	jsonb,
	pgTable,
	serial,
	text,
	timestamp
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth.schema';

export const ACTIVITY_KINDS = [
	'school',
	'study',
	'meal',
	'break',
	'friends',
	'sport',
	'family',
	'chores',
	'sleep',
	'other'
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const personalActivity = pgTable(
	'personal_activity',
	{
		id: serial('id').primaryKey(),
		studentId: text('student_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		kind: text('kind', { enum: ACTIVITY_KINDS }).notNull(),
		/** optional words, e.g. "Football practice" */
		label: text('label'),
		/** weekdays it repeats on, 0 = Sunday */
		days: jsonb('days').$type<number[]>().notNull(),
		startMinute: integer('start_minute').notNull(),
		endMinute: integer('end_minute').notNull(),
		active: boolean('active').notNull().default(true),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('personal_activity_student').on(t.studentId),
		check('personal_activity_start', sql`${t.startMinute} between 0 and 1439`),
		check('personal_activity_end', sql`${t.endMinute} between 1 and 1440`),
		check('personal_activity_order', sql`${t.endMinute} > ${t.startMinute}`)
	]
);
