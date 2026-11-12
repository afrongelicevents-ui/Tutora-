import type { IconName } from '#lib/components/LineIcon.svelte';

/** The icon for each kind of activity on the personal schedule. */
export const KIND_ICON: Record<string, IconName> = {
	school: 'sun',
	study: 'book',
	meal: 'meal',
	break: 'cup',
	friends: 'family',
	sport: 'ball',
	family: 'home',
	chores: 'check',
	sleep: 'moon',
	other: 'more'
};
export const KINDS = Object.keys(KIND_ICON);
