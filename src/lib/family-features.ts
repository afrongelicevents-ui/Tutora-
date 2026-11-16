// Which pages are part of Tutora Family (the rest — finding a tutor, booking, paying the
// tutor, receipts, settings, safety — is always free). Checked on the server for every
// request, page data and form posts included (hooks.server.ts → familyGate).

export const FAMILY_FEATURES = {
	'/student/planner': 'planner',
	'/student/check': 'check',
	'/student/homework': 'homework',
	'/student/messages': 'messages',
	'/student/buddies': 'buddies',
	'/student/quiz': 'tests',
	'/parent/progress': 'progress',
	'/parent/report': 'report',
	'/parent/personal': 'personal',
	'/parent/school-plus': 'school'
} as const;

export type FamilyFeature = (typeof FAMILY_FEATURES)[keyof typeof FAMILY_FEATURES];

export function familyFeatureFor(pathname: string): FamilyFeature | null {
	// a tutor's stored reports, opened from the (free) child page
	if (/^\/parent\/child\/[^/]+\/reports(\/|$)/.test(pathname)) return 'report';
	for (const [prefix, f] of Object.entries(FAMILY_FEATURES))
		if (pathname === prefix || pathname.startsWith(prefix + '/')) return f;
	return null;
}

/** where a locked feature sends the person */
export function lockedLocation(pathname: string, feature: FamilyFeature) {
	return pathname.startsWith('/parent')
		? `/parent/plans?locked=${feature}`
		: `/student/upgrade?locked=${feature}`;
}
