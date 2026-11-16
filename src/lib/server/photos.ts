/** Owner → Photos: the owner's own photo for a place on the site (see #lib/photo-slots.ts). */
import { eq } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { photoSlot } from './db/app.schema.ts';
import { forgetShared, sharedFor } from './cache.ts';
import type { PhotoSlotKey, PhotoVersions } from '#lib/photo-slots.ts';

/** Photos are shrunk on the phone first; on the site they must stay small for mobile data. */
export const PHOTO_MAX_BYTES = 60 * 1024;

const rows = (db: DB) => db.select().from(photoSlot);

/**
 * Which slots have the owner's photo (and its version), for every page. The same for
 * everyone and rarely changed: kept in memory for five minutes (cleared at once on change).
 */
export function photoVersions(db: DB): Promise<PhotoVersions> {
	return sharedFor('photos:versions', 5 * 60_000, async () => {
		const out: PhotoVersions = {};
		for (const r of await rows(db)) out[r.slot as PhotoSlotKey] = r.version;
		return out;
	});
}

/** Every chosen photo with its details (owner page). */
export const photoSlots = (db: DB) => rows(db);

export async function photoFor(db: DB, slot: PhotoSlotKey) {
	const [r] = await db.select().from(photoSlot).where(eq(photoSlot.slot, slot));
	return r ?? null;
}

/** Puts a new photo in a slot; the storage key of the photo it replaces (to delete), or null. */
export async function setPhoto(
	db: DB,
	slot: PhotoSlotKey,
	v: { storageKey: string; credit: string | null; setBy: string }
) {
	const old = await photoFor(db, slot);
	// a new number every time (also after "back to the standard"), so no old copy is shown
	const version = Math.max((old?.version ?? 0) + 1, Math.floor(Date.now() / 1000));
	await db
		.insert(photoSlot)
		.values({
			slot,
			storageKey: v.storageKey,
			credit: v.credit,
			rightsConfirmed: true,
			setBy: v.setBy,
			version
		})
		.onConflictDoUpdate({
			target: photoSlot.slot,
			set: {
				storageKey: v.storageKey,
				credit: v.credit,
				rightsConfirmed: true,
				setBy: v.setBy,
				setAt: new Date(),
				version
			}
		});
	forgetShared('photos:');
	return old?.storageKey ?? null;
}

/** Back to the standard photo; the storage key of the removed photo, or null. */
export async function clearPhoto(db: DB, slot: PhotoSlotKey) {
	const r = await db
		.delete(photoSlot)
		.where(eq(photoSlot.slot, slot))
		.returning({ key: photoSlot.storageKey });
	forgetShared('photos:');
	return r[0]?.key ?? null;
}
