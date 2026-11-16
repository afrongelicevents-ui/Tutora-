/**
 * Owner switches kept in `site_content` (no schema change): `feature:<name>` = '1' means on.
 *
 * - `video_room`: Tutora's own low-data video lesson room (the old one). OFF by default:
 *   live lessons happen in Teams, Google Meet or Zoom through the tutor's pasted link. The
 *   room's code stays, so the owner can switch it back on in Owner → Settings if needed.
 *
 * Kept in this worker's memory for a minute; a change by the owner is seen at once here.
 */
import { eq } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { siteContent } from './db/app.schema.ts';
import { forgetShared, sharedFor } from './cache.ts';

export const FLAGS = ['video_room'] as const;
export type Flag = (typeof FLAGS)[number];

const key = (f: Flag) => `feature:${f}`;

export function flagOn(db: DB, f: Flag): Promise<boolean> {
	return sharedFor(`flag:${f}`, 60_000, async () => {
		const [row] = await db
			.select({ value: siteContent.value })
			.from(siteContent)
			.where(eq(siteContent.key, key(f)));
		return row?.value === '1';
	});
}

export async function setFlag(db: DB, f: Flag, on: boolean) {
	if (on)
		await db
			.insert(siteContent)
			.values({ key: key(f), value: '1' })
			.onConflictDoUpdate({ target: siteContent.key, set: { value: '1', updatedAt: new Date() } });
	else await db.delete(siteContent).where(eq(siteContent.key, key(f)));
	forgetShared(`flag:${f}`);
}

/** Is Tutora's own (old) video lesson room switched on? Default: no. */
export const videoRoomOn = (db: DB) => flagOn(db, 'video_room');
