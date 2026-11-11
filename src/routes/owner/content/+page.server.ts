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

/** The homepage photo must stay small for mobile data (it is shrunk on the phone first). */
const HERO_MAX_BYTES = 90 * 1024;

export const load: PageServerLoad = async ({ locals, url }) => {
	requireOwner(locals.user, url);
	const [c, subjects] = await Promise.all([getContent(locals.db), listPlatformSubjects(locals.db)]);
	return { c: { ...c, heroPhoto: !!c.heroPhoto }, subjects };
};

export const actions: Actions = {
	texts: async ({ locals, url, request }) => {
		const me = requireOwner(locals.user, url);
		const f = formObject(await request.formData());
		await setContent(locals.db, 'hero_title', (f.heroTitle ?? '').trim().slice(0, 80));
		await setContent(locals.db, 'hero_lead', (f.heroLead ?? '').trim().slice(0, 200));
		await setContent(locals.db, 'join_lead', (f.joinLead ?? '').trim().slice(0, 200));
		await audit(locals.db, me.id, 'homepage_text', null);
		return { saved: true };
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
			return { saved: true };
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
		return { saved: true };
	},
	addSubject: async ({ locals, url, request }) => {
		const me = requireOwner(locals.user, url);
		const name = (formObject(await request.formData()).name ?? '').trim().slice(0, 60);
		if (name.length < 2) return fail(400, { error: 'err_required' });
		await addPlatformSubject(locals.db, name);
		await audit(locals.db, me.id, 'subject_added', null, name);
		return { saved: true };
	},
	removeSubject: async ({ locals, url, request }) => {
		const me = requireOwner(locals.user, url);
		const id = Number(formObject(await request.formData()).id) || 0;
		await removePlatformSubject(locals.db, id);
		await audit(locals.db, me.id, 'subject_removed', String(id));
		return { saved: true };
	}
};
