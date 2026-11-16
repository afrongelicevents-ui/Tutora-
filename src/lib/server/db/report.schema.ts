import { date, index, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth.schema';

const ts = (name: string) => timestamp(name, { withTimezone: true });
const userRef = (name: string) =>
	text(name)
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' });

export const REPORT_STATUS = ['draft', 'sent'] as const;
export type ReportStatus = (typeof REPORT_STATUS)[number];

/** The figures a stored report was built from (kept as they were when it was made). */
export interface ReportFigures {
	lessons: { booked: number; attended: number; missed: number };
	homework: { set: number; done: number; late: number; missing: number; waiting: number };
	checkins: { count: number; days: number };
	tests: { subject: string; chapter: string; pct: number; tests: number }[];
	/** average % over all tests in the period, null without tests */
	testAvg: number | null;
}

/**
 * A tutor's report about one student for a period (a month, or dates the tutor picks):
 * built from lessons, homework, check-ins and tests, plus the tutor's short note. Kept in
 * Tutora; the family sees it once sent (and can download it as a PDF).
 */
export const studentReport = pgTable(
	'student_report',
	{
		id: serial('id').primaryKey(),
		tutorId: userRef('tutor_id'),
		studentId: userRef('student_id'),
		periodStart: date('period_start').notNull(),
		periodEnd: date('period_end').notNull(),
		note: text('note'),
		figures: jsonb('figures').$type<ReportFigures>().notNull(),
		status: text('status', { enum: REPORT_STATUS }).notNull().default('draft'),
		sentAt: ts('sent_at'),
		createdAt: ts('created_at').notNull().defaultNow(),
		updatedAt: ts('updated_at').notNull().defaultNow()
	},
	(t) => [
		index('student_report_student_idx').on(t.studentId, t.status),
		index('student_report_tutor_idx').on(t.tutorId)
	]
);
