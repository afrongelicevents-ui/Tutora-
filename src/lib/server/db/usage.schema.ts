import { integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Hourly usage against the free limits (Cloudflare Workers + Neon), written by the GitHub
 * hourly job (scripts/deploy/usage.ts) and shown in Owner → Free limits. Never written by a
 * web request, so it costs the site nothing.
 */
export const usageSnapshot = pgTable('usage_snapshot', {
	id: serial('id').primaryKey(),
	takenAt: timestamp('taken_at', { withTimezone: true }).notNull().defaultNow(),
	/** 'live' or 'test' */
	site: text('site').notNull(),
	/** what was measured (see usage.ts `Usage`) */
	data: jsonb('data').notNull()
});

/** An alert already sent today, so the owner hears about each limit once a day at most. */
export const usageAlert = pgTable('usage_alert', {
	key: text('key').primaryKey(),
	sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
	level: integer('level').notNull().default(0)
});
