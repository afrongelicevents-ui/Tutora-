import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireOwner } from '#lib/server/guards.ts';
import { audit } from '#lib/server/owner.ts';
import { clearPhoto, PHOTO_MAX_BYTES, photoSlots, setPhoto } from '#lib/server/photos.ts';
import { isPhotoSlot } from '#lib/photo-slots.ts';
import { readUpload, IMAGE_KINDS, newKey } from '#lib/server/files.ts';
import { getStore } from '#lib/server/storage.ts';
import { doneFrom, doneRedirect } from '../done.ts';

/** Content → Photos: every place on the site that shows a photo; replace or go back. */
export const load: PageServerLoad = async ({ locals, url }) => {
	requireOwner(locals.user, url);
	const rows = await photoSlots(locals.db);
	return {
		chosen: Object.fromEntries(
			rows.map((r) => [r.slot, { version: r.version, credit: r.credit, setAt: r.setAt }])
		),
		done: doneFrom(url)
	};
};

export const actions: Actions = {
	replace: async ({ locals, url, request, platform }) => {
		const me = requireOwner(locals.user, url);
		const data = await request.formData();
		const slot = String(data.get('slot') ?? '');
		if (!isPhotoSlot(slot)) return fail(400, { error: 'err_generic' });
		// only photos the owner may use: they confirm it each time
		const credit =
			String(data.get('credit') ?? '')
				.trim()
				.slice(0, 120) || null;
		if (data.get('rights') !== 'on') return fail(400, { error: 'err_photo_rights', slot, credit });
		const photo = await readUpload(data.get('photo'), {
			maxBytes: PHOTO_MAX_BYTES,
			allowed: IMAGE_KINDS,
			required: true
		});
		if (!photo?.ok)
			return fail(400, {
				error:
					photo?.error === 'err_file_big' ? 'err_hero_big' : (photo?.error ?? 'err_file_missing'),
				slot,
				credit
			});
		const store = getStore(platform);
		const key = newKey('public', photo.ext);
		await store.put(key, photo.bytes, photo.kind);
		const old = await setPhoto(locals.db, slot, { storageKey: key, credit, setBy: me.id });
		if (old && old !== key) await store.delete(old).catch(() => {});
		await audit(locals.db, me.id, 'photo_replaced', slot, credit);
		doneRedirect(url, 'owner_done_photo');
	},
	remove: async ({ locals, url, request, platform }) => {
		const me = requireOwner(locals.user, url);
		const data = await request.formData();
		const slot = String(data.get('slot') ?? '');
		if (!isPhotoSlot(slot)) return fail(400, { error: 'err_generic' });
		if (data.get('sure') !== 'on') return fail(400, { error: 'err_tick_sure', slot });
		const old = await clearPhoto(locals.db, slot);
		if (old)
			await getStore(platform)
				.delete(old)
				.catch(() => {});
		await audit(locals.db, me.id, 'photo_removed', slot);
		doneRedirect(url, 'owner_done_photo_standard');
	}
};
