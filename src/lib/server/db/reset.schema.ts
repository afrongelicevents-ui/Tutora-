import { index, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth.schema';

/**
 * One-time password reset links made by the owner (while the site has no email service).
 * Only a SHA-256 hash of the link's secret is stored; a link works once, for 24 hours.
 */
export const passwordResetLink = pgTable(
	'password_reset_link',
	{
		id: serial('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		tokenHash: text('token_hash').notNull().unique(),
		createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		usedAt: timestamp('used_at', { withTimezone: true })
	},
	(t) => [index('password_reset_link_user_idx').on(t.userId)]
);
