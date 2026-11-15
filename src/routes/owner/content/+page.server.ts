import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireOwner } from '#lib/server/guards.ts';
import { getContent, setContent } from '#lib/server/content.ts';
import {
	addPlatformSubject,
	audit,
	listPlatformSubjects,
	removePlatformSubject
} from '#lib/server/owner.ts';
import { readUpload, IMAGE_KINDS, newKey } from '#lib/server/files.ts';
import { getStore } from '#lib/server/storage.ts';
import { formObject } from '#lib/validation/auth.ts';
import { doneFrom, doneRedirect } from '../done.ts';

/** The homepage photo must stay small for mobile data (it is shrunk on the phone first). */
const HERO_MAX_BYTES = 60 * 1024;

export const load: PageServerLoad = async ({ locals, url }) => {
	requireOwner(locals.user, url);
	const [c, subjects] = await Promise.all([getContent(locals.db), listPlatformSubjects(locals.db)]);
	return { c: { ...c, heroPhoto: !!c.heroPhoto }, subjects, done: doneFrom(url) };
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
	},
	photo: async ({ locals, url, request, platform }) => {
		const me = requireOwner(locals.user, url);
		const data = await request.formData();
		const store = getStore(platform);
		const old = (await getContent(locals.db)).heroPhoto;
		if (data.get('remove') === 'on') {
			if (old) await store.delete(old).catch(() => {});
			await setContent(locals.db, 'hero_photo', '');
			await audit(locals.db, me.id, 'homepage_photo_removed', null);
			doneRedirect(url, 'saved');
		}
		const photo = await readUpload(data.get('photo'), {
			maxBytes: HERO_MAX_BYTES,
			allowed: IMAGE_KINDS,
			required: true
		});
		if (!photo?.ok)
			return fail(400, {
				error:
					photo?.error === 'err_file_big' ? 'err_hero_big' : (photo?.error ?? 'err_file_missing')
			});
		const key = newKey('public', photo.ext);
		await store.put(key, photo.bytes, photo.kind);
		if (old) await store.delete(old).catch(() => {});
		const v = (await getContent(locals.db)).heroPhotoV + 1;
		await setContent(locals.db, 'hero_photo', key);
		await setContent(locals.db, 'hero_photo_v', String(v));
		await audit(locals.db, me.id, 'homepage_photo', null);
		doneRedirect(url, 'saved');
	},
	addSubject: async ({ locals, url, request }) => {
		const me = requireOwner(locals.user, url);
		const name = (formObject(await request.formData()).name ?? '')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, 60);
		if (name.length < 2) return fail(400, { error: 'err_required' });
		// "mathematics " and "Mathematics" are the same subject: nothing changes, nothing logged
		if ((await addPlatformSubject(locals.db, name)) === 'exists')
			return fail(400, { error: 'oc_subject_exists', name });
		await audit(locals.db, me.id, 'subject_added', null, name);
		doneRedirect(url, 'oc_done_subject_added');
	},
	removeSubject: async ({ locals, url, request }) => {
		const me = requireOwner(locals.user, url);
		const f = formObject(await request.formData());
		if (f.sure !== 'on') return fail(400, { error: 'err_tick_sure' });
		const name = await removePlatformSubject(locals.db, Number(f.id) || 0);
		if (!name) return fail(404, { error: 'err_not_found' });
		await audit(locals.db, me.id, 'subject_removed', f.id ?? null, name);
		doneRedirect(url, 'oc_done_subject_removed');
	}
};
