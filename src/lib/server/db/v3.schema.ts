/**
 * Tutora v3: connected academic support.
 * Family Connection, check-ins, school work, study accountability, assessments,
 * lesson materials, Connected Tools and the School+ Academic Partnership.
 * Every number shown in the app is computed from these rows; nothing is invented.
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
	timestamp,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth.schema';
import { attendee, homework, homeworkAnswer, lesson } from './app.schema';

const ts = (name: string) => timestamp(name, { withTimezone: true });
const created = () => ts('created_at').notNull().defaultNow();
const userRef = (name: string) =>
	text(name)
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' });

/* ------------------------------------------------------------------ Family Connection */

/**
 * A one-time code a student makes to invite a parent or guardian. Only a SHA-256
 * fingerprint is stored. Works once, expires after 48 hours, can be revoked.
 */
export const familyInvite = pgTable(
	'family_invite',
	{
		id: serial('id').primaryKey(),
		studentId: userRef('student_id'),
		codeHash: text('code_hash').notNull(),
		/** the code's first 3 letters, so the student can recognise it in their list */
		hint: text('hint').notNull(),
		expiresAt: ts('expires_at').notNull(),
		usedAt: ts('used_at'),
		usedBy: text('used_by').references(() => user.id, { onDelete: 'set null' }),
		revokedAt: ts('revoked_at'),
		createdAt: created()
	},
	(t) => [
		uniqueIndex('family_invite_hash').on(t.codeHash),
		index('family_invite_student').on(t.studentId)
	]
);

export const LINK_STATUS = ['active', 'pending_guardian'] as const;

/**
 * A parent or guardian connected to a student. A parent can follow several children.
 * `guardian`: manages permissions for a child under 18 (and created a younger child's account).
 * The share flags say what the parent sees; private messages, tutor notes and check-ins the
 * student did not share are never visible, whatever the flags say.
 */
export const familyLink = pgTable(
	'family_link',
	{
		parentId: userRef('parent_id'),
		studentId: userRef('student_id'),
		guardian: boolean('guardian').notNull().default(false),
		status: text('status', { enum: LINK_STATUS }).notNull().default('active'),
		/** what the student calls them, e.g. "Mum" (optional) */
		label: text('label'),
		shareProgress: boolean('share_progress').notNull().default(true),
		shareLessons: boolean('share_lessons').notNull().default(true),
		shareHomework: boolean('share_homework').notNull().default(true),
		shareStudy: boolean('share_study').notNull().default(true),
		inviteId: integer('invite_id').references(() => familyInvite.id, { onDelete: 'set null' }),
		createdAt: created()
	},
	(t) => [
		primaryKey({ columns: [t.parentId, t.studentId] }),
		index('family_link_student').on(t.studentId),
		check('family_link_not_self', sql`${t.parentId} <> ${t.studentId}`)
	]
);

/** Permissions a guardian sets for a child under 18. */
export const guardianPermission = pgTable('guardian_permission', {
	studentId: text('student_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	/** may connect outside tools such as Google Drive */
	toolsAllowed: boolean('tools_allowed').notNull().default(false),
	/** a new parent who joins with the child's code needs the guardian's OK first */
	approveNewFamily: boolean('approve_new_family').notNull().default(true),
	updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
	updatedAt: created()
});

/* ------------------------------------------------------------------ Check-ins */

export const CHECKIN_MOODS = [
	'confident',
	'finding_hard',
	'need_help',
	'motivated',
	'need_break'
] as const;
export type CheckinMood = (typeof CHECKIN_MOODS)[number];

/** How learning feels today. The student decides, per check-in, whether family sees it. */
export const checkin = pgTable(
	'checkin',
	{
		id: serial('id').primaryKey(),
		studentId: userRef('student_id'),
		mood: text('mood', { enum: CHECKIN_MOODS }).notNull(),
		subject: text('subject'),
		/** private words for themselves and their tutor; never shown to family */
		note: text('note'),
		sharedWithFamily: boolean('shared_with_family').notNull().default(false),
		sharedWithTutor: boolean('shared_with_tutor').notNull().default(true),
		createdAt: created()
	},
	(t) => [index('checkin_student').on(t.studentId, t.createdAt)]
);

/* ------------------------------------------------------------------ School work */

/** School and year, entered by the student or a parent. */
export const schoolInfo = pgTable('school_info', {
	studentId: text('student_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	school: text('school'),
	year: text('year'),
	enteredBy: text('entered_by').references(() => user.id, { onDelete: 'set null' }),
	updatedAt: created()
});

/**
 * One subject at school: syllabus, textbook and what class is on now.
 * Entered by the student or parent, then checked by a tutor. Editing clears the check.
 */
export const schoolSubject = pgTable(
	'school_subject',
	{
		id: serial('id').primaryKey(),
		studentId: userRef('student_id'),
		subject: text('subject').notNull(),
		syllabus: text('syllabus'),
		textbook: text('textbook'),
		currentTopic: text('current_topic'),
		enteredBy: text('entered_by').references(() => user.id, { onDelete: 'set null' }),
		checkedBy: text('checked_by').references(() => user.id, { onDelete: 'set null' }),
		checkedAt: ts('checked_at'),
		updatedAt: created()
	},
	(t) => [index('school_subject_student').on(t.studentId)]
);

/* ------------------------------------------------------------------ Study accountability */

/** A repeating weekly study slot. weekday 0 = Sunday; minutes after midnight, Zimbabwe time. */
export const studyPlanItem = pgTable(
	'study_plan_item',
	{
		id: serial('id').primaryKey(),
		studentId: userRef('student_id'),
		weekday: integer('weekday').notNull(),
		startMinute: integer('start_minute').notNull(),
		minutes: integer('minutes').notNull(),
		subject: text('subject').notNull(),
		topic: text('topic'),
		createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
		active: boolean('active').notNull().default(true),
		createdAt: created()
	},
	(t) => [
		index('study_plan_student').on(t.studentId),
		check('study_plan_day', sql`${t.weekday} between 0 and 6`),
		check('study_plan_start', sql`${t.startMinute} between 0 and 1439`),
		check('study_plan_len', sql`${t.minutes} between 5 and 240`)
	]
);

/** A focus session: started and finished by the student. Streaks count days with one done. */
export const studySession = pgTable(
	'study_session',
	{
		id: serial('id').primaryKey(),
		studentId: userRef('student_id'),
		planItemId: integer('plan_item_id').references(() => studyPlanItem.id, {
			onDelete: 'set null'
		}),
		subject: text('subject').notNull(),
		topic: text('topic'),
		plannedMinutes: integer('planned_minutes').notNull(),
		startedAt: ts('started_at').notNull().defaultNow(),
		endedAt: ts('ended_at'),
		status: text('status', { enum: ['running', 'done', 'stopped'] })
			.notNull()
			.default('running'),
		createdAt: created()
	},
	(t) => [index('study_session_student').on(t.studentId, t.startedAt)]
);

/** The parent was told "study time starts now" for this plan slot on this date (no repeats). */
export const studyAlertSent = pgTable(
	'study_alert_sent',
	{
		planItemId: integer('plan_item_id')
			.notNull()
			.references(() => studyPlanItem.id, { onDelete: 'cascade' }),
		onDate: date('on_date').notNull(),
		createdAt: created()
	},
	(t) => [primaryKey({ columns: [t.planItemId, t.onDate] })]
);

/** An exam the student is working towards; readiness is computed per topic from results. */
export const exam = pgTable(
	'exam',
	{
		id: serial('id').primaryKey(),
		studentId: userRef('student_id'),
		subject: text('subject').notNull(),
		title: text('title').notNull(),
		examOn: date('exam_on'),
		topics: jsonb('topics').$type<string[]>().notNull().default([]),
		createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
		createdAt: created()
	},
	(t) => [index('exam_student').on(t.studentId)]
);

/* ------------------------------------------------------------------ Assessments */

/** A tutor's quiz or test: multiple-choice questions on one subject and topic. */
export const questionSet = pgTable(
	'question_set',
	{
		id: serial('id').primaryKey(),
		tutorId: userRef('tutor_id'),
		kind: text('kind', { enum: ['quiz', 'test'] })
			.notNull()
			.default('quiz'),
		title: text('title').notNull(),
		subject: text('subject').notNull(),
		topic: text('topic').notNull(),
		level: text('level'),
		/** questions may be used in students' short daily knowledge checks */
		dailyChecks: boolean('daily_checks').notNull().default(true),
		createdAt: created()
	},
	(t) => [index('question_set_tutor').on(t.tutorId)]
);

export const question = pgTable(
	'question',
	{
		id: serial('id').primaryKey(),
		setId: integer('set_id')
			.notNull()
			.references(() => questionSet.id, { onDelete: 'cascade' }),
		prompt: text('prompt').notNull(),
		choices: jsonb('choices').$type<string[]>().notNull(),
		answer: integer('answer').notNull(),
		explanation: text('explanation'),
		sortOrder: integer('sort_order').notNull().default(0)
	},
	(t) => [index('question_set_idx').on(t.setId), check('question_answer', sql`${t.answer} >= 0`)]
);

/** A quiz or test a tutor set for one student. */
export const quizAssignment = pgTable(
	'quiz_assignment',
	{
		id: serial('id').primaryKey(),
		setId: integer('set_id')
			.notNull()
			.references(() => questionSet.id, { onDelete: 'cascade' }),
		studentId: userRef('student_id'),
		dueOn: date('due_on'),
		doneAt: ts('done_at'),
		createdAt: created()
	},
	(t) => [uniqueIndex('quiz_assignment_once').on(t.setId, t.studentId)]
);

export const RESULT_SOURCES = ['test', 'quiz', 'kahoot', 'daily_check', 'homework'] as const;

/**
 * One scored piece of work on one topic: a marked test, a quiz, a Kahoot! score, a daily
 * knowledge check or marked homework. Progress, scores per topic and exam readiness are
 * all computed from these rows.
 */
export const assessmentResult = pgTable(
	'assessment_result',
	{
		id: serial('id').primaryKey(),
		studentId: userRef('student_id'),
		tutorId: text('tutor_id').references(() => user.id, { onDelete: 'set null' }),
		source: text('source', { enum: RESULT_SOURCES }).notNull(),
		title: text('title').notNull(),
		subject: text('subject').notNull(),
		topic: text('topic').notNull(),
		score: integer('score').notNull(),
		maxScore: integer('max_score').notNull(),
		feedback: text('feedback'),
		takenOn: date('taken_on').notNull(),
		setId: integer('set_id').references(() => questionSet.id, { onDelete: 'set null' }),
		homeworkAnswerId: integer('homework_answer_id').references(() => homeworkAnswer.id, {
			onDelete: 'set null'
		}),
		createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
		createdAt: created()
	},
	(t) => [
		index('result_student').on(t.studentId, t.takenOn),
		check('result_score', sql`${t.maxScore} > 0 and ${t.score} between 0 and ${t.maxScore}`)
	]
);

/* ------------------------------------------------------------------ Materials and resources */

export const MATERIAL_KINDS = ['drive', 'kahoot', 'link', 'file'] as const;

/** Files and links on one lesson (Drive files, kahoots, other links, uploaded files). */
export const lessonMaterial = pgTable(
	'lesson_material',
	{
		id: serial('id').primaryKey(),
		lessonId: integer('lesson_id')
			.notNull()
			.references(() => lesson.id, { onDelete: 'cascade' }),
		tutorId: userRef('tutor_id'),
		kind: text('kind', { enum: MATERIAL_KINDS }).notNull(),
		title: text('title').notNull(),
		url: text('url'),
		driveFileId: text('drive_file_id'),
		fileKey: text('file_key'),
		createdAt: created()
	},
	(t) => [index('lesson_material_lesson').on(t.lessonId)]
);

/** Revision resources, per subject; for one student or for all of the tutor's students. */
export const resource = pgTable(
	'resource',
	{
		id: serial('id').primaryKey(),
		tutorId: userRef('tutor_id'),
		/** null: all of this tutor's students */
		studentId: text('student_id').references(() => user.id, { onDelete: 'cascade' }),
		subject: text('subject').notNull(),
		level: text('level'),
		kind: text('kind', { enum: MATERIAL_KINDS }).notNull(),
		title: text('title').notNull(),
		url: text('url'),
		driveFileId: text('drive_file_id'),
		fileKey: text('file_key'),
		createdAt: created()
	},
	(t) => [index('resource_tutor').on(t.tutorId)]
);

/** Files attached to homework (set by the tutor) or to an answer (handed in by the student). */
export const homeworkLink = pgTable('homework_link', {
	id: serial('id').primaryKey(),
	homeworkId: integer('homework_id').references(() => homework.id, { onDelete: 'cascade' }),
	answerId: integer('answer_id').references(() => homeworkAnswer.id, { onDelete: 'cascade' }),
	kind: text('kind', { enum: MATERIAL_KINDS }).notNull(),
	title: text('title').notNull(),
	url: text('url'),
	driveFileId: text('drive_file_id'),
	createdAt: created()
});

/** What the tutor writes for the student after a lesson (the private note stays private). */
export const lessonFeedback = pgTable('lesson_feedback', {
	attendeeId: integer('attendee_id')
		.primaryKey()
		.references(() => attendee.id, { onDelete: 'cascade' }),
	text: text('text').notNull(),
	updatedAt: created()
});

/* ------------------------------------------------------------------ Connected Tools */

export const PROVIDERS = ['google', 'microsoft'] as const;
export type Provider = (typeof PROVIDERS)[number];

/**
 * An outside account connected with OAuth. Tokens are encrypted (AES-GCM) with a key only
 * the server has, and are never sent to the browser. Disconnecting deletes the row and
 * revokes the token where the provider allows it.
 */
export const connectedAccount = pgTable(
	'connected_account',
	{
		id: serial('id').primaryKey(),
		userId: userRef('user_id'),
		provider: text('provider', { enum: PROVIDERS }).notNull(),
		accountEmail: text('account_email'),
		scopes: text('scopes').notNull(),
		accessTokenEnc: text('access_token_enc').notNull(),
		refreshTokenEnc: text('refresh_token_enc'),
		expiresAt: ts('expires_at'),
		connectedAt: created()
	},
	(t) => [uniqueIndex('connected_account_once').on(t.userId, t.provider)]
);

export const MEETING_TOOLS = ['room', 'meet', 'teams'] as const;
export type MeetingTool = (typeof MEETING_TOOLS)[number];

/** Which tools a person uses. Everything is off until they choose it. */
export const toolPref = pgTable('tool_pref', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	/** tutors: how online lessons are run by default */
	meetingTool: text('meeting_tool', { enum: MEETING_TOOLS }).notNull().default('room'),
	kahootOn: boolean('kahoot_on').notNull().default(false),
	updatedAt: created()
});

/** Online meeting created for a lesson (Meet or Teams). The low-data room always works too. */
export const lessonMeeting = pgTable('lesson_meeting', {
	lessonId: integer('lesson_id')
		.primaryKey()
		.references(() => lesson.id, { onDelete: 'cascade' }),
	provider: text('provider', { enum: ['meet', 'teams'] }).notNull(),
	joinUrl: text('join_url').notNull(),
	externalId: text('external_id'),
	createdAt: created()
});

/* ------------------------------------------------------------------ School+ */

export const PARTNERSHIP_STATUS = [
	'requested',
	'school_invited',
	'active',
	'declined',
	'stopped'
] as const;

/**
 * Premium Academic Partnership: with the parent's written consent, the tutor and the
 * schoolteacher work together. The school takes part only if it agrees. Every message is
 * logged and the parent can read the log and stop the partnership at any time.
 */
export const partnership = pgTable(
	'partnership',
	{
		id: serial('id').primaryKey(),
		studentId: userRef('student_id'),
		parentId: userRef('parent_id'),
		tutorId: userRef('tutor_id'),
		subject: text('subject').notNull(),
		schoolName: text('school_name').notNull(),
		teacherName: text('teacher_name').notNull(),
		teacherEmail: text('teacher_email'),
		status: text('status', { enum: PARTNERSHIP_STATUS }).notNull().default('requested'),
		/** the written consent, as the parent signed it */
		consentText: text('consent_text').notNull(),
		consentName: text('consent_name').notNull(),
		consentAt: ts('consent_at').notNull(),
		/** fingerprint of the private link the school uses to answer and to message */
		schoolTokenHash: text('school_token_hash'),
		schoolRespondedAt: ts('school_responded_at'),
		stoppedAt: ts('stopped_at'),
		stoppedBy: text('stopped_by').references(() => user.id, { onDelete: 'set null' }),
		createdAt: created()
	},
	(t) => [
		index('partnership_parent').on(t.parentId),
		index('partnership_tutor').on(t.tutorId),
		uniqueIndex('partnership_token').on(t.schoolTokenHash)
	]
);

/** Every message and every step in a partnership (the log the parent can read). */
export const partnershipLog = pgTable(
	'partnership_log',
	{
		id: serial('id').primaryKey(),
		partnershipId: integer('partnership_id')
			.notNull()
			.references(() => partnership.id, { onDelete: 'cascade' }),
		kind: text('kind', { enum: ['message', 'event'] }).notNull(),
		fromRole: text('from_role', { enum: ['parent', 'tutor', 'teacher', 'system'] }).notNull(),
		fromName: text('from_name').notNull(),
		body: text('body').notNull(),
		createdAt: created()
	},
	(t) => [index('partnership_log_p').on(t.partnershipId, t.createdAt)]
);

/* ------------------------------------------------------------------ Reports */

/** Weekly family report already announced (one per parent, child and week). */
export const weeklyReportSent = pgTable(
	'weekly_report_sent',
	{
		parentId: userRef('parent_id'),
		studentId: userRef('student_id'),
		weekStart: date('week_start').notNull(),
		createdAt: created()
	},
	(t) => [primaryKey({ columns: [t.parentId, t.studentId, t.weekStart] })]
);
