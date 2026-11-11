import {
	customType,
	bigserial,
	boolean,
	check,
	date,
	index,
	integer,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex,
	bigint,
	primaryKey
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth.schema';

const ts = (name: string) => timestamp(name, { withTimezone: true });
const created = () => ts('created_at').notNull().defaultNow();
/** The tutor (a user with role "tutor") this row belongs to. Every tutor's data is separate. */
const tutorRef = () =>
	text('tutor_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' });

/**
 * Extra details for students and parents.
 * For students under 18 a parent/guardian contact is required (validated in the app and here).
 * A parent account books for one child, whose name is stored in childName.
 */
export const profile = pgTable(
	'profile',
	{
		userId: text('user_id')
			.primaryKey()
			.references(() => user.id, { onDelete: 'cascade' }),
		phone: text('phone'),
		isUnder18: boolean('is_under_18').notNull().default(false),
		parentName: text('parent_name'),
		parentPhone: text('parent_phone'),
		parentEmail: text('parent_email'),
		childName: text('child_name'),
		level: text('level'),
		consentAt: ts('consent_at').notNull(),
		createdAt: created(),
		updatedAt: ts('updated_at')
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date())
	},
	(t) => [
		check(
			'profile_minor_needs_parent',
			sql`not ${t.isUnder18} or (${t.parentName} is not null and ${t.parentPhone} is not null)`
		)
	]
);

export const CURRENCIES = ['USD', 'ZWG'] as const;
export const LESSON_MODES = ['online', 'in_person', 'both'] as const;
export const GROUP_MODES = ['one_to_one', 'groups', 'both'] as const;

/** draft: filling in the profile; pending: submitted for approval; rejected: needs changes */
export const TUTOR_STATUS = ['draft', 'pending', 'active', 'rejected', 'suspended'] as const;

/**
 * Everything one tutor sets up: their public page, how lessons work, prices, contact and
 * payment details. Every personal field starts empty; the public page hides empty sections.
 * `status`: new tutors wait for the platform owner's approval ("pending").
 * `plan` / `planUntil`: ready for tutor billing later (everyone is on "free" for now).
 */
export const tutorProfile = pgTable(
	'tutor_profile',
	{
		tutorId: text('tutor_id')
			.primaryKey()
			.references(() => user.id, { onDelete: 'cascade' }),
		/** address of the public page: /t/<slug> */
		slug: text('slug').notNull(),
		status: text('status', { enum: TUTOR_STATUS }).notNull().default('pending'),
		approvedAt: ts('approved_at'),
		submittedAt: ts('submitted_at'),
		/** why the owner did not approve (shown to the tutor) */
		rejectReason: text('reject_reason'),
		plan: text('plan').notNull().default('free'),
		planUntil: ts('plan_until'),
		// profile
		tutorName: text('tutor_name'),
		headline: text('headline'),
		bio: text('bio'),
		qualifications: text('qualifications'),
		yearsTeaching: integer('years_teaching'),
		teachingStyle: text('teaching_style'),
		town: text('town'),
		photoKey: text('photo_key'),
		photoVersion: integer('photo_version').notNull().default(0),
		// how lessons work
		lessonModes: text('lesson_modes', { enum: LESSON_MODES }).notNull().default('online'),
		groupMode: text('group_mode', { enum: GROUP_MODES }).notNull().default('one_to_one'),
		maxGroupSize: integer('max_group_size').notNull().default(4),
		lessonMinutes: integer('lesson_minutes').notNull().default(60),
		cancelHours: integer('cancel_hours').notNull().default(24),
		// prices
		defaultPriceCents: integer('default_price_cents'),
		showPrices: boolean('show_prices').notNull().default(false),
		currency: text('currency', { enum: CURRENCIES }).notNull().default('USD'),
		// contact
		whatsappNumber: text('whatsapp_number'),
		phone: text('phone'),
		contactEmail: text('contact_email'),
		// payment details (shown to this tutor's logged-in students only)
		bankName: text('bank_name'),
		bankAccountName: text('bank_account_name'),
		bankAccountNumber: text('bank_account_number'),
		bankBranch: text('bank_branch'),
		ecocashNumber: text('ecocash_number'),
		ecocashName: text('ecocash_name'),
		innbucksNumber: text('innbucks_number'),
		innbucksName: text('innbucks_name'),
		paymentNote: text('payment_note'),
		// results may only be shown with permission
		resultsConsent: boolean('results_consent').notNull().default(false),
		/** offers the free 15-minute intro chat */
		offersIntro: boolean('offers_intro').notNull().default(true),
		/** takes cash (in person) */
		acceptsCash: boolean('accepts_cash').notNull().default(true),
		// setup wizard
		setupStep: integer('setup_step').notNull().default(0),
		setupDoneAt: ts('setup_done_at'),
		createdAt: created(),
		updatedAt: ts('updated_at')
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date())
	},
	(t) => [
		uniqueIndex('tutor_profile_slug').on(t.slug),
		index('tutor_profile_status_idx').on(t.status),
		check('tutor_profile_group', sql`${t.maxGroupSize} between 2 and 20`),
		check('tutor_profile_len', sql`${t.lessonMinutes} between 15 and 240`),
		check('tutor_profile_slug_ok', sql`${t.slug} ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$'`)
	]
);

/**
 * A student or parent account linked to a tutor (made when they sign up from the tutor's
 * page or book with them). A tutor only ever sees their own enrolled students.
 */
export const enrollment = pgTable(
	'enrollment',
	{
		tutorId: tutorRef(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		/** the tutor's note of the student's level, e.g. "Form 3" */
		level: text('level'),
		createdAt: created()
	},
	(t) => [primaryKey({ columns: [t.tutorId, t.userId] }), index('enrollment_user_idx').on(t.userId)]
);

export const subject = pgTable(
	'subject',
	{
		id: serial('id').primaryKey(),
		tutorId: tutorRef(),
		name: text('name').notNull(),
		/** e.g. "Grade 7, O Level, A Level" */
		levels: text('levels').notNull().default(''),
		priceCents: integer('price_cents'),
		sortOrder: integer('sort_order').notNull().default(0),
		active: boolean('active').notNull().default(true),
		createdAt: created()
	},
	(t) => [index('subject_tutor_idx').on(t.tutorId)]
);

export const lessonPackage = pgTable(
	'lesson_package',
	{
		id: serial('id').primaryKey(),
		tutorId: tutorRef(),
		name: text('name').notNull(),
		lessonCount: integer('lesson_count').notNull(),
		priceCents: integer('price_cents').notNull(),
		active: boolean('active').notNull().default(true),
		createdAt: created()
	},
	(t) => [
		check('package_count', sql`${t.lessonCount} between 1 and 100`),
		check('package_price', sql`${t.priceCents} >= 0`)
	]
);

/** Weekly free times. Minutes since midnight, Zimbabwe time. weekday 0 = Sunday. */
export const availability = pgTable(
	'availability',
	{
		id: serial('id').primaryKey(),
		tutorId: tutorRef(),
		weekday: integer('weekday').notNull(),
		startMinute: integer('start_minute').notNull(),
		endMinute: integer('end_minute').notNull()
	},
	(t) => [
		check('availability_day', sql`${t.weekday} between 0 and 6`),
		check(
			'availability_range',
			sql`${t.startMinute} >= 0 and ${t.endMinute} <= 1440 and ${t.startMinute} < ${t.endMinute}`
		)
	]
);

export const resultHighlight = pgTable('result_highlight', {
	id: serial('id').primaryKey(),
	tutorId: tutorRef(),
	value: text('value').notNull(),
	label: text('label').notNull(),
	sortOrder: integer('sort_order').notNull().default(0)
});

export const review = pgTable(
	'review',
	{
		id: serial('id').primaryKey(),
		tutorId: tutorRef(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		/** what is shown publicly, e.g. "Tendai" or "T.M." */
		displayName: text('display_name').notNull(),
		rating: integer('rating').notNull(),
		text: text('text').notNull(),
		/** hidden by the platform owner (e.g. abusive) */
		hidden: boolean('hidden').notNull().default(false),
		reply: text('reply'),
		repliedAt: ts('replied_at'),
		reportedAt: ts('reported_at'),
		reportReason: text('report_reason'),
		createdAt: created()
	},
	(t) => [
		uniqueIndex('review_one_per_tutor_user').on(t.tutorId, t.userId),
		check('review_rating', sql`${t.rating} between 1 and 5`)
	]
);

export const LESSON_KINDS = ['lesson', 'intro'] as const;
export const PLACE = ['online', 'in_person'] as const;

export const lesson = pgTable(
	'lesson',
	{
		id: serial('id').primaryKey(),
		tutorId: tutorRef(),
		kind: text('kind', { enum: LESSON_KINDS }).notNull().default('lesson'),
		subjectId: integer('subject_id').references(() => subject.id),
		mode: text('mode', { enum: PLACE }).notNull(),
		startsAt: ts('starts_at').notNull(),
		endsAt: ts('ends_at').notNull(),
		capacity: integer('capacity').notNull().default(1),
		status: text('status', { enum: ['scheduled', 'cancelled'] })
			.notNull()
			.default('scheduled'),
		reminded24: boolean('reminded_24').notNull().default(false),
		reminded1: boolean('reminded_1').notNull().default(false),
		createdAt: created()
	},
	(t) => [
		index('lesson_starts_idx').on(t.startsAt),
		index('lesson_tutor_idx').on(t.tutorId, t.startsAt),
		check('lesson_time', sql`${t.startsAt} < ${t.endsAt}`)
	]
);

export const BOOKING_STATUS = [
	'requested',
	'accepted',
	'declined',
	'proposed',
	'cancelled'
] as const;

export const booking = pgTable(
	'booking',
	{
		id: serial('id').primaryKey(),
		tutorId: tutorRef(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		kind: text('kind', { enum: LESSON_KINDS }).notNull().default('lesson'),
		subjectId: integer('subject_id').references(() => subject.id),
		mode: text('mode', { enum: PLACE }).notNull(),
		startsAt: ts('starts_at').notNull(),
		endsAt: ts('ends_at').notNull(),
		childId: integer('child_id'),
		note: text('note'),
		status: text('status', { enum: BOOKING_STATUS }).notNull().default('requested'),
		proposedStartsAt: ts('proposed_starts_at'),
		tutorMessage: text('tutor_message'),
		lessonId: integer('lesson_id').references(() => lesson.id),
		createdAt: created(),
		decidedAt: ts('decided_at')
	},
	(t) => [
		index('booking_user_idx').on(t.userId),
		index('booking_status_idx').on(t.status),
		index('booking_tutor_idx').on(t.tutorId, t.status)
	]
);

export const studentPackage = pgTable(
	'student_package',
	{
		id: serial('id').primaryKey(),
		tutorId: tutorRef(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		packageId: integer('package_id').references(() => lessonPackage.id),
		name: text('name').notNull(),
		lessonsTotal: integer('lessons_total').notNull(),
		lessonsUsed: integer('lessons_used').notNull().default(0),
		priceCents: integer('price_cents').notNull(),
		createdAt: created()
	},
	(t) => [check('student_package_used', sql`${t.lessonsUsed} between 0 and ${t.lessonsTotal}`)]
);

/** A student (or parent account) booked on a lesson. Groups have several attendees. */
export const attendee = pgTable(
	'attendee',
	{
		id: serial('id').primaryKey(),
		lessonId: integer('lesson_id')
			.notNull()
			.references(() => lesson.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		bookingId: integer('booking_id').references(() => booking.id),
		priceCents: integer('price_cents').notNull().default(0),
		studentPackageId: integer('student_package_id').references(() => studentPackage.id),
		status: text('status', { enum: ['booked', 'cancelled'] })
			.notNull()
			.default('booked'),
		/** tutor's private note for this student in this lesson */
		privateNote: text('private_note'),
		/** set by the tutor after the lesson */
		attendance: text('attendance', { enum: ['completed', 'absent'] }),
		/** for a parent account: which child this place is for */
		childId: integer('child_id'),
		createdAt: created()
	},
	(t) => [
		uniqueIndex('attendee_once').on(t.lessonId, t.userId),
		index('attendee_user_idx').on(t.userId)
	]
);

/** Tutor's own calendar entries (not lessons). */
export const calendarEvent = pgTable(
	'calendar_event',
	{
		id: serial('id').primaryKey(),
		tutorId: tutorRef(),
		/** personal: the tutor's own event; blocked: holiday / not available */
		kind: text('kind', { enum: ['personal', 'blocked'] })
			.notNull()
			.default('personal'),
		title: text('title').notNull(),
		startsAt: ts('starts_at').notNull(),
		endsAt: ts('ends_at').notNull(),
		note: text('note'),
		createdAt: created()
	},
	(t) => [check('event_time', sql`${t.startsAt} < ${t.endsAt}`)]
);

/** Money owed: one row per booked lesson (not covered by a package) or package bought. */
export const charge = pgTable(
	'charge',
	{
		id: serial('id').primaryKey(),
		tutorId: tutorRef(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		kind: text('kind', { enum: ['lesson', 'package'] }).notNull(),
		attendeeId: integer('attendee_id').references(() => attendee.id),
		studentPackageId: integer('student_package_id').references(() => studentPackage.id),
		description: text('description').notNull(),
		amountCents: integer('amount_cents').notNull(),
		voided: boolean('voided').notNull().default(false),
		createdAt: created()
	},
	(t) => [
		index('charge_user_idx').on(t.userId),
		index('charge_tutor_user_idx').on(t.tutorId, t.userId),
		check('charge_amount', sql`${t.amountCents} >= 0`)
	]
);

export const PAYMENT_METHODS = ['bank', 'ecocash', 'innbucks', 'cash', 'other'] as const;
export const PAYMENT_STATUS = ['pending', 'confirmed', 'rejected'] as const;

export const payment = pgTable(
	'payment',
	{
		id: serial('id').primaryKey(),
		tutorId: tutorRef(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		amountCents: integer('amount_cents').notNull(),
		currency: text('currency', { enum: CURRENCIES }).notNull(),
		method: text('method', { enum: PAYMENT_METHODS }).notNull(),
		reference: text('reference'),
		paidOn: date('paid_on').notNull(),
		proofKey: text('proof_key'),
		status: text('status', { enum: PAYMENT_STATUS }).notNull().default('pending'),
		rejectReason: text('reject_reason'),
		recordedBy: text('recorded_by', { enum: ['student', 'tutor'] }).notNull(),
		receiptNo: integer('receipt_no'),
		createdAt: created(),
		decidedAt: ts('decided_at')
	},
	(t) => [
		// receipt numbers are counted per tutor
		uniqueIndex('payment_tutor_receipt_no').on(t.tutorId, t.receiptNo),
		index('payment_user_idx').on(t.userId),
		index('payment_tutor_idx').on(t.tutorId, t.status),
		check('payment_amount', sql`${t.amountCents} > 0`)
	]
);

export const paymentAllocation = pgTable('payment_allocation', {
	id: serial('id').primaryKey(),
	paymentId: integer('payment_id')
		.notNull()
		.references(() => payment.id, { onDelete: 'cascade' }),
	chargeId: integer('charge_id')
		.notNull()
		.references(() => charge.id, { onDelete: 'cascade' }),
	amountCents: integer('amount_cents').notNull()
});

export const homework = pgTable('homework', {
	id: serial('id').primaryKey(),
	tutorId: tutorRef(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	note: text('note'),
	fileKey: text('file_key'),
	fileName: text('file_name'),
	dueOn: date('due_on'),
	createdAt: created()
});

export const homeworkAnswer = pgTable('homework_answer', {
	id: serial('id').primaryKey(),
	homeworkId: integer('homework_id')
		.notNull()
		.references(() => homework.id, { onDelete: 'cascade' }),
	note: text('note'),
	fileKey: text('file_key'),
	fileName: text('file_name'),
	feedback: text('feedback'),
	checkedAt: ts('checked_at'),
	createdAt: created()
});

/** Lesson room: who knocked / was let in. */
export const roomParticipant = pgTable(
	'room_participant',
	{
		lessonId: integer('lesson_id')
			.notNull()
			.references(() => lesson.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		status: text('status', { enum: ['waiting', 'admitted', 'left'] }).notNull(),
		lastSeen: ts('last_seen').notNull().defaultNow()
	},
	(t) => [uniqueIndex('room_participant_pk').on(t.lessonId, t.userId)]
);

/** WebRTC set-up messages between two people in a lesson room (deleted after the lesson). */
export const roomSignal = pgTable(
	'room_signal',
	{
		id: bigserial('id', { mode: 'number' }).primaryKey(),
		lessonId: integer('lesson_id')
			.notNull()
			.references(() => lesson.id, { onDelete: 'cascade' }),
		fromUser: text('from_user').notNull(),
		toUser: text('to_user').notNull(),
		kind: text('kind', { enum: ['offer', 'answer', 'ice', 'bye'] }).notNull(),
		payload: text('payload').notNull(),
		createdAt: created()
	},
	(t) => [index('room_signal_to_idx').on(t.lessonId, t.toUser, t.id)]
);

export const roomFile = pgTable('room_file', {
	id: serial('id').primaryKey(),
	lessonId: integer('lesson_id')
		.notNull()
		.references(() => lesson.id, { onDelete: 'cascade' }),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	fileKey: text('file_key').notNull(),
	fileName: text('file_name').notNull(),
	createdAt: created()
});

/** Fixed-window counters for app actions (login, sign-up, booking, uploads). */
export const actionLimit = pgTable('action_limit', {
	key: text('key').primaryKey(),
	count: integer('count').notNull(),
	/** epoch ms when the window resets */
	resetAt: bigint('reset_at', { mode: 'number' }).notNull()
});

const bytea = customType<{ data: Uint8Array; driverData: Buffer | Uint8Array }>({
	dataType: () => 'bytea',
	toDriver: (v) => v,
	fromDriver: (v) => new Uint8Array(v)
});

/**
 * Uploaded files (payment proofs, homework, lesson files, the tutor's photo) kept in the
 * database, so no separate file-storage account is needed. Files are small (max 5 MB).
 */
export const fileBlob = pgTable('file_blob', {
	key: text('key').primaryKey(),
	contentType: text('content_type').notNull(),
	data: bytea('data').notNull(),
	createdAt: created()
});

/**
 * The one-time code that lets the platform owner create their account at /setup. Made by the deploy
 * workflow; only a SHA-256 fingerprint is stored. Deleted as soon as it has been used.
 */
export const setupCode = pgTable(
	'setup_code',
	{
		id: integer('id').primaryKey().default(1),
		codeHash: text('code_hash').notNull(),
		expiresAt: ts('expires_at').notNull(),
		createdAt: created()
	},
	(t) => [check('setup_code_singleton', sql`${t.id} = 1`)]
);

/** A parent's children (a parent can book for several). Never shown publicly. */
export const child = pgTable(
	'child',
	{
		id: serial('id').primaryKey(),
		parentId: text('parent_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		level: text('level'),
		schoolYear: text('school_year'),
		createdAt: created()
	},
	(t) => [index('child_parent_idx').on(t.parentId)]
);

/** Tutors a student saved. */
export const favourite = pgTable(
	'favourite',
	{
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		tutorId: tutorRef(),
		createdAt: created()
	},
	(t) => [primaryKey({ columns: [t.userId, t.tutorId] })]
);

/** In-app notifications (also sent by email when an email service is on). */
export const notification = pgTable(
	'notification',
	{
		id: serial('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		/** booking | lesson | payment | homework | review | account | reminder */
		kind: text('kind').notNull(),
		title: text('title').notNull(),
		body: text('body').notNull(),
		link: text('link'),
		readAt: ts('read_at'),
		createdAt: created()
	},
	(t) => [index('notification_user_idx').on(t.userId, t.createdAt)]
);

/** What a person does not want to be told (only non-essential messages can be switched off). */
export const notificationPref = pgTable('notification_pref', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	emailOff: boolean('email_off').notNull().default(false),
	remindersOff: boolean('reminders_off').notNull().default(false),
	homeworkOff: boolean('homework_off').notNull().default(false)
});

/** Contact form and reports to the Tutora team. */
export const supportRequest = pgTable('support_request', {
	id: serial('id').primaryKey(),
	userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
	name: text('name').notNull(),
	email: text('email').notNull(),
	topic: text('topic').notNull().default('help'),
	message: text('message').notNull(),
	status: text('status', { enum: ['open', 'done'] })
		.notNull()
		.default('open'),
	createdAt: created()
});

/** Every action the platform owner takes (who, what, on what). */
export const auditLog = pgTable(
	'audit_log',
	{
		id: serial('id').primaryKey(),
		actorId: text('actor_id'),
		action: text('action').notNull(),
		target: text('target'),
		detail: text('detail'),
		createdAt: created()
	},
	(t) => [index('audit_log_created_idx').on(t.createdAt)]
);

/** Editable homepage texts and photo (owner admin). */
export const siteContent = pgTable('site_content', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
	updatedAt: created()
});

/** The platform's standard subjects (suggestions for tutors, filters for students). */
export const platformSubject = pgTable(
	'platform_subject',
	{
		id: serial('id').primaryKey(),
		name: text('name').notNull(),
		sortOrder: integer('sort_order').notNull().default(0)
	},
	(t) => [uniqueIndex('platform_subject_name').on(t.name)]
);
