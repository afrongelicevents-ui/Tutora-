import { boolean, integer, pgTable, text, timestamp, bigint, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth.schema';

/**
 * Extra details for students and parents.
 * For students under 18 a parent/guardian contact is required (validated in the app).
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
		level: text('level'),
		consentAt: timestamp('consent_at', { withTimezone: true }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
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

/**
 * One row of tutor-editable site settings (id is always 1).
 * More fields are added in later phases (availability, payment details, ...).
 */
export const siteSettings = pgTable(
	'site_settings',
	{
		id: integer('id').primaryKey().default(1),
		tutorName: text('tutor_name').notNull().default('Your tutor'),
		/** E.164 without spaces, e.g. +263774231904 */
		whatsappNumber: text('whatsapp_number').notNull().default('+263774231904'),
		currency: text('currency', { enum: ['USD', 'ZWG'] })
			.notNull()
			.default('USD'),
		showPrices: boolean('show_prices').notNull().default(false),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date())
	},
	(t) => [check('site_settings_singleton', sql`${t.id} = 1`)]
);

/** Fixed-window counters for app actions (login, sign-up, booking, uploads). */
export const actionLimit = pgTable('action_limit', {
	key: text('key').primaryKey(),
	count: integer('count').notNull(),
	/** epoch ms when the window resets */
	resetAt: bigint('reset_at', { mode: 'number' }).notNull()
});
