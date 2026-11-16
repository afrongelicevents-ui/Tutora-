/**
 * Every place on the site that shows a photo (Owner → Photos). Each has a standard photo
 * from the project; the owner can put another one in its place or go back to the standard.
 * Shared by the server (which slots exist) and the pages (which address to show).
 */
export const PHOTO_SLOTS = [
	{ key: 'home', standard: '/photos/family-study.webp', w: 612, h: 408 },
	{ key: 'join', standard: '/photos/parent-helping.webp', w: 625, h: 640 },
	{ key: 'student_home', standard: '/photos/students-together.webp', w: 640, h: 640 },
	{ key: 'parent_home', standard: '/photos/family-study.webp', w: 612, h: 408 },
	{ key: 'parent_tutors', standard: '/photos/parent-helping.webp', w: 625, h: 640 },
	{ key: 'school_plus', standard: '/photos/parent-computer.webp', w: 640, h: 640 },
	{ key: 'tutor_home', standard: '/photos/parent-helping.webp', w: 625, h: 640 }
] as const;

export type PhotoSlotKey = (typeof PHOTO_SLOTS)[number]['key'];
export const isPhotoSlot = (k: string): k is PhotoSlotKey => PHOTO_SLOTS.some((s) => s.key === k);

/** slot → version of the owner's photo (only slots with one) */
export type PhotoVersions = Partial<Record<PhotoSlotKey, number>>;

/** The address to show for a slot: the owner's photo when there is one, else the standard. */
export function photoSrc(versions: PhotoVersions | undefined | null, key: PhotoSlotKey): string {
	const v = versions?.[key];
	if (v) return `/photo/${key}?v=${v}`;
	return PHOTO_SLOTS.find((s) => s.key === key)!.standard;
}
