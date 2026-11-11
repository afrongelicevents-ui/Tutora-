import { eq, inArray } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { siteContent } from './db/app.schema.ts';

/** Homepage texts the owner can change (empty = the built-in wording). */
export const CONTENT_KEYS = ['hero_title', 'hero_lead', 'join_lead'] as const;
export type ContentKey = (typeof CONTENT_KEYS)[number];

export async function getContent(db: DB) {
	const rows = await db
		.select()
		.from(siteContent)
		.where(inArray(siteContent.key, [...CONTENT_KEYS, 'hero_photo', 'hero_photo_v']));
	const get = (k: string) => rows.find((r) => r.key === k)?.value ?? '';
	return {
		heroTitle: get('hero_title'),
		heroLead: get('hero_lead'),
		joinLead: get('join_lead'),
		heroPhoto: get('hero_photo') || null,
		heroPhotoV: Number(get('hero_photo_v')) || 0
	};
}

export async function setContent(db: DB, key: string, value: string) {
	if (!value) {
		await db.delete(siteContent).where(eq(siteContent.key, key));
		return;
	}
	await db
		.insert(siteContent)
		.values({ key, value })
		.onConflictDoUpdate({ target: siteContent.key, set: { value, updatedAt: new Date() } });
}
