import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth.schema';

/**
 * The owner's say over "Tutora recommended tutors": a tutor can be pinned (shown first when
 * they match the child) or hidden (never recommended). Set only by the owner, never by a
 * tutor, and never for money.
 */
export const RECOMMEND_MODES = ['pinned', 'hidden'] as const;
export type RecommendMode = (typeof RECOMMEND_MODES)[number];

export const recommendPref = pgTable('recommend_pref', {
	tutorId: text('tutor_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	mode: text('mode', { enum: RECOMMEND_MODES }).notNull(),
	setBy: text('set_by').references(() => user.id, { onDelete: 'set null' }),
	setAt: timestamp('set_at', { withTimezone: true }).notNull().defaultNow()
});
