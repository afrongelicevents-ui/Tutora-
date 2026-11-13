import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { ownProfile, saveCard, setPhoto } from '#lib/server/buddies.ts';
import { mySubjects } from '#lib/server/student-home.ts';
import { IMAGE_KINDS, newKey, readUpload } from '#lib/server/files.ts';
import { getStore } from '#lib/server/storage.ts';
import { hitLimit } from '#lib/server/rate-limit.ts';
import { tellOwners } from '#lib/server/buddy-notify.ts';

/** A cropped photo from the browser is about 20–40 KB; anything bigger is refused. */
const PHOTO_MAX = 150 * 1024;

export const load: PageServerLoad = async ({ locals, url }) => {
	const u = requireRole(locals.user, url, ['student']);
	const [p, suggested] = await Promise.all([
		ownProfile(locals.db, u.id),
		mySubjects(locals.db, u.id)
	]);
	return { id: u.id, profile: p, suggested };
};

const text = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v : '');

export const actions: Actions = {
	save: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['student']);
		const f = await request.formData();
		const before = await ownProfile(locals.db, u.id);
		const r = await saveCard(locals.db, u.id, {
			displayName: text(f.get('displayName')),
			bio: text(f.get('bio')),
			grade: text(f.get('grade')),
			school: text(f.get('school')),
			subjects: text(f.get('subjects')).split(','),
			favouriteSubject: text(f.get('favouriteSubject')),
			goals: text(f.get('goals')),
			birthDate: text(f.get('birthDate'))
		});
		if (!r.ok)
			return fail(400, { error: r.error, values: Object.fromEntries(f) as Record<string, string> });
		const after = await ownProfile(locals.db, u.id);
		if (after.bio && after.bio !== before.bio) await tellOwners(locals.db, u.id);
		redirect(303, '/student/me');
	},
	photo: async ({ locals, url, request, platform }) => {
		const u = requireRole(locals.user, url, ['student']);
		if (!(await hitLimit(locals.db, 'profilePhoto', u.id)).ok)
			return fail(429, { error: 'err_too_many' });
		const up = await readUpload((await request.formData()).get('photo'), {
			maxBytes: PHOTO_MAX,
			allowed: IMAGE_KINDS,
			required: true
		});
		if (!up || !up.ok)
			return fail(400, {
				error:
					up && !up.ok && up.error === 'err_file_big'
						? 'err_photo_big'
						: (up?.error ?? 'err_file_missing')
			});
		const store = getStore(platform);
		const key = newKey('student-photos', up.ext);
		await store.put(key, up.bytes, up.kind);
		const old = await setPhoto(locals.db, u.id, key);
		if (old) await store.delete(old).catch(() => {});
		await tellOwners(locals.db, u.id);
		return { photo: 'saved' };
	},
	removePhoto: async ({ locals, url, platform }) => {
		const u = requireRole(locals.user, url, ['student']);
		const old = await setPhoto(locals.db, u.id, null);
		if (old)
			await getStore(platform)
				.delete(old)
				.catch(() => {});
		return { photo: 'removed' };
	}
};
