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
	'/student/reports': 'report',
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

/** Marks links to Tutora Family pages (`data-fam`), for the free level's "Tutora Family" label. */
export function labelFamilyLinks(html: string, label: string): string {
	const safe = label.replace(/[&<>"']/g, '');
	return html.replace(/<a\b([^>]*?)\shref="(\/[^"]*)"/g, (all, before: string, href: string) => {
		if (before.includes('data-fam') || !familyFeatureFor(href.split(/[?#]/)[0])) return all;
		return `<a${before} data-fam="${safe}" href="${href}"`;
	});
}
