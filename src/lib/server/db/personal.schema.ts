/**
 * Personal progress: the child's own day and life organisation (not school results).
 * Personal tasks (wake up on time, tidy room, read 20 min...), ticks on today's plan, weekly
 * personal goals ("Go to bed by 9 PM, 5 days"), and whether family may see the personal report.
 */
import {
	boolean,
	check,
	date,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	serial,
	text,
	timestamp
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth.schema';

const ts = (name: string) => timestamp(name, { withTimezone: true });
const created = () => ts('created_at').notNull().defaultNow();
const userRef = (name: string) =>
	text(name)
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' });

/** A personal task: repeating on weekdays, or just for one date. Time is optional. */
export const personalTask = pgTable(
	'personal_task',
	{
		id: serial('id').primaryKey(),
		studentId: userRef('student_id'),
		title: text('title').notNull(),
		/** minutes after midnight, or null for "any time" */
		minute: integer('minute'),
		/** weekdays it repeats on (0 = Sunday); null when it's for one date */
		days: jsonb('days').$type<number[]>(),
		onDate: date('on_date'),
		active: boolean('active').notNull().default(true),
		createdAt: created()
	},
	(t) => [
		index('personal_task_student').on(t.studentId),
		check('personal_task_minute', sql`${t.minute} is null or ${t.minute} between 0 and 1439`)
	]
);

/** Something on the day's plan was done. Item keys: t<task id>, a<activity id>, p<study slot id>. */
export const dayTick = pgTable(
	'day_tick',
	{
		studentId: userRef('student_id'),
		onDate: date('on_date').notNull(),
		itemKey: text('item_key').notNull(),
		createdAt: created()
	},
	(t) => [primaryKey({ columns: [t.studentId, t.onDate, t.itemKey] })]
);

/** A weekly personal goal, e.g. "Go to bed by 9 PM" on 5 days of the week. */
export const personalGoal = pgTable(
	'personal_goal',
	{
		id: serial('id').primaryKey(),
		studentId: userRef('student_id'),
		title: text('title').notNull(),
		targetDays: integer('target_days').notNull(),
		active: boolean('active').notNull().default(true),
		createdAt: created()
	},
	(t) => [
		index('personal_goal_student').on(t.studentId),
		check('personal_goal_target', sql`${t.targetDays} between 1 and 7`)
	]
);

/** A day the student says they kept a weekly goal. */
export const goalTick = pgTable(
	'goal_tick',
	{
		goalId: integer('goal_id')
			.notNull()
			.references(() => personalGoal.id, { onDelete: 'cascade' }),
		onDate: date('on_date').notNull(),
		createdAt: created()
	},
	(t) => [primaryKey({ columns: [t.goalId, t.onDate] })]
);

/** The child's choice: may their family see the personal report summary? (default: no) */
export const personalPref = pgTable('personal_pref', {
	studentId: text('student_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	shareReport: boolean('share_report').notNull().default(false),
	updatedAt: created()
});

/** The morning "plan your day" reminder was sent (no repeats). */
export const plannerReminderSent = pgTable(
	'planner_reminder_sent',
	{
		studentId: userRef('student_id'),
		onDate: date('on_date').notNull(),
		createdAt: created()
	},
	(t) => [primaryKey({ columns: [t.studentId, t.onDate] })]
);
