import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { emailEnabled } from '#lib/server/auth.ts';

/** Without an email service nobody is asked to check their email: go and log in instead. */
export const load: PageServerLoad = ({ locals, url }) => {
	if (emailEnabled) return;
	const next = url.searchParams.get('next');
	const safe = next && /^\/[a-z0-9/?=&_-]*$/i.test(next) && !next.startsWith('//') ? next : null;
	if (locals.user) redirect(303, safe ?? '/');
	redirect(303, `/login${safe ? `?next=${encodeURIComponent(safe)}` : ''}`);
};
