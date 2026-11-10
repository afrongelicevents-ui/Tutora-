import { eq } from 'drizzle-orm';
import type { DB } from './db/types';
import { siteSettings } from './db/app.schema';

export type SiteSettings = typeof siteSettings.$inferSelect;

export async function getSettings(db: DB): Promise<SiteSettings> {
	const rows = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1);
	if (rows[0]) return rows[0];
	const created = await db.insert(siteSettings).values({ id: 1 }).onConflictDoNothing().returning();
	return created[0] ?? (await db.select().from(siteSettings).where(eq(siteSettings.id, 1)))[0];
}
