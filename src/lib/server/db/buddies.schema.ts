/**
 * Student profiles and Study Buddies.
 * A buddy is another student connected ONLY through a one-time buddy code (no search, no
 * suggestions). Children under 13 need a parent's approval for each buddy; 13–17 year olds'
 * parents are told and can remove buddies. Buddies see a short whitelist of profile fields.
 * Photos and bios are checked by the owner before buddies can see them.
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

const ts = (name: string) => timestamp(name, { withTimezone: true });
const created = () => ts('created_at').notNull().defaultNow();
const userRef = (name: string) =>
	text(name)
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' });

export const MODERATION = ['none', 'pending', 'approved', 'rejected'] as const;
export type Moderation = (typeof MODERATION)[number];

/** What a student shows on their profile. Private fields are marked. */
export const studentCard = pgTable('student_card', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	/** "Amina D." (first name and one initial) */
	displayName: text('display_name'),
	bio: text('bio'),
	bioStatus: text('bio_status', { enum: MODERATION }).notNull().default('none'),
	grade: text('grade'),
	/** private: only the student, their family and the owner see it */
	school: text('school'),
	subjects: jsonb('subjects').$type<string[]>().notNull().default([]),
	favouriteSubject: text('favourite_subject'),
	goals: text('goals'),
	/** private: only used to work out age rules; never shown to buddies */
	birthDate: date('birth_date'),
	photoKey: text('photo_key'),
	photoVersion: integer('photo_version').notNull().default(0),
	photoStatus: text('photo_status', { enum: MODERATION }).notNull().default('none'),
	updatedAt: created()
});

/** A one-time buddy code (expires after 7 days, works once). */
export const buddyCode = pgTable(
	'buddy_code',
	{
		code: text('code').primaryKey(),
		studentId: userRef('student_id'),
		createdAt: created(),
		expiresAt: ts('expires_at').notNull(),
		usedAt: ts('used_at')
	},
	(t) => [index('buddy_code_student').on(t.studentId)]
);

/** Two students who study together. aId < bId so each pair exists once. */
export const buddyLink = pgTable(
	'buddy_link',
	{
		id: serial('id').primaryKey(),
		aId: userRef('a_id'),
		bId: userRef('b_id'),
		status: text('status', { enum: ['pending', 'active'] })
			.notNull()
			.default('pending'),
		/** under 13: that child's parent must approve */
		needParentA: boolean('need_parent_a').notNull().default(false),
		needParentB: boolean('need_parent_b').notNull().default(false),
		approvedA: ts('approved_a'),
		approvedB: ts('approved_b'),
		createdAt: created()
	},
	(t) => [uniqueIndex('buddy_link_pair').on(t.aId, t.bId), index('buddy_link_b').on(t.bId)]
);

/** "I don't want to hear from this student": ends the link and stops new ones. */
export const buddyBlock = pgTable(
	'buddy_block',
	{
		blockerId: userRef('blocker_id'),
		blockedId: userRef('blocked_id'),
		createdAt: created()
	},
	(t) => [primaryKey({ columns: [t.blockerId, t.blockedId] })]
);

/** Preset encouragements only: no free text, no pictures. */
export const buddyMessage = pgTable(
	'buddy_message',
	{
		id: serial('id').primaryKey(),
		fromId: userRef('from_id'),
		toId: userRef('to_id'),
		preset: text('preset').notNull(),
		createdAt: created()
	},
	(t) => [index('buddy_message_to').on(t.toId, t.createdAt)]
);

/** A report about another student's photo, bio or behaviour, for the owner's queue. */
export const buddyReport = pgTable(
	'buddy_report',
	{
		id: serial('id').primaryKey(),
		reporterId: userRef('reporter_id'),
		reportedId: userRef('reported_id'),
		what: text('what', { enum: ['photo', 'bio', 'behaviour', 'other'] }).notNull(),
		note: text('note'),
		status: text('status', { enum: ['open', 'resolved'] })
			.notNull()
			.default('open'),
		resolvedBy: text('resolved_by').references(() => user.id, { onDelete: 'set null' }),
		resolvedAt: ts('resolved_at'),
		createdAt: created()
	},
	(t) => [index('buddy_report_status').on(t.status, t.createdAt)]
);
