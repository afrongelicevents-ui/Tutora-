import type { Actions, PageServerLoad } from './$types';
import { requireOwner } from '#lib/server/guards.ts';
import { getContent, setContent } from '#lib/server/content.ts';
import { audit } from '#lib/server/owner.ts';
import { formObject } from '#lib/validation/auth.ts';
import { doneFrom, doneRedirect } from '../done.ts';

/** Content → Homepage texts. (Photos: /owner/photos; the subjects list: /owner/subjects.) */
export const load: PageServerLoad = async ({ locals, url }) => {
	requireOwner(locals.user, url);
	return { c: await getContent(locals.db), done: doneFrom(url) };
};

export const actions: Actions = {
	texts: async ({ locals, url, request }) => {
		const me = requireOwner(locals.user, url);
		const f = formObject(await request.formData());
		const next = {
			heroTitle: (f.heroTitle ?? '').trim().slice(0, 80),
			heroLead: (f.heroLead ?? '').trim().slice(0, 200),
			joinLead: (f.joinLead ?? '').trim().slice(0, 200)
		};
		const before = await getContent(locals.db);
		await setContent(locals.db, 'hero_title', next.heroTitle);
		await setContent(locals.db, 'hero_lead', next.heroLead);
		await setContent(locals.db, 'join_lead', next.joinLead);
		// the log says which texts changed, in plain words
		const changed = (
			[
				['heroTitle', 'title'],
				['heroLead', 'line under it'],
				['joinLead', 'tutor sign-up page']
			] as const
		)
			.filter(([k]) => (before[k] ?? '') !== next[k])
			.map(([k, label]) => `${label}: ${next[k] || '(standard wording)'}`);
		if (changed.length) await audit(locals.db, me.id, 'homepage_text', null, changed.join(' · '));
		doneRedirect(url, 'saved');
	}
};
