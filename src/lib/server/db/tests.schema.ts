/**
 * Tests built from the question bank, and the AI test maker's daily use.
 * See src/lib/server/tests.ts and src/lib/server/ai-tests.ts.
 */
import {
	boolean,
	date,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	serial,
	text,
	timestamp,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { user } from './auth.schema';
import { quizAssignment, type QuestionType } from './v3.schema';

const ts = (name: string) => timestamp(name, { withTimezone: true });

/**
 * One question as one student got it: their order, their shuffled choices, their numbers
 * (maths templates). Kept with the attempt, so marking never changes when the bank is edited.
 * Answers (`answerIdx`, `accepted`, `expected`) never go to the browser before handing in.
 */
export interface AttemptItem {
	qid: number;
	type: QuestionType;
	prompt: string;
	choices: string[];
	/** mcq: index of the right choice in `choices` (as shuffled) */
	answerIdx: number;
	/** short answer: accepted answers */
	accepted: string[];
	/** maths template: the worked-out answer */
	expected: number | null;
	decimals: number;
	marks: number;
	chapter: string;
	explanation: string | null;
	/** marks given; null = still to mark (written, or overridden later) */
	awarded: number | null;
	/** what the student answered */
	given: string | null;
}

/** A student taking one built test (one per assignment). */
export const testAttempt = pgTable(
	'test_attempt',
	{
		id: serial('id').primaryKey(),
		assignmentId: integer('assignment_id')
			.notNull()
			.references(() => quizAssignment.id, { onDelete: 'cascade' }),
		studentId: text('student_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		items: jsonb('items').$type<AttemptItem[]>().notNull(),
		startedAt: ts('started_at').notNull().defaultNow(),
		/** startedAt + the test's timer; null = no time limit */
		deadlineAt: ts('deadline_at'),
		submittedAt: ts('submitted_at'),
		/** handed in after the time limit, or closed automatically at the deadline */
		late: boolean('late').notNull().default(false),
		autoClosed: boolean('auto_closed').notNull().default(false),
		/** written answers (or overrides) still to mark */
		needsMarking: boolean('needs_marking').notNull().default(false),
		markedAt: ts('marked_at'),
		score: integer('score'),
		maxScore: integer('max_score').notNull().default(0),
		createdAt: ts('created_at').notNull().defaultNow()
	},
	(t) => [
		uniqueIndex('test_attempt_assignment_uq').on(t.assignmentId),
		index('test_attempt_student_idx').on(t.studentId)
	]
);

/**
 * Workers AI use per UTC day and tutor, in Cloudflare "neurons" (our own careful estimate,
 * counted BEFORE each call). The free plan gives 10,000 a day; we stop well before that.
 */
export const aiUsage = pgTable(
	'ai_usage',
	{
		day: date('day').notNull(),
		tutorId: text('tutor_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		neurons: integer('neurons').notNull().default(0),
		calls: integer('calls').notNull().default(0),
		updatedAt: ts('updated_at').notNull().defaultNow()
	},
	(t) => [primaryKey({ columns: [t.day, t.tutorId] }), index('ai_usage_day_idx').on(t.day)]
);
