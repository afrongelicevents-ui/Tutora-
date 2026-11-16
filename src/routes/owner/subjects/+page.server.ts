import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireOwner } from '#lib/server/guards.ts';
import {
	addPlatformSubject,
	audit,
	listPlatformSubjects,
	removePlatformSubject
} from '#lib/server/owner.ts';
import { formObject } from '#lib/validation/auth.ts';
import { doneFrom, doneRedirect } from '../done.ts';

/** Learning → Subjects: the platform's standard subject list (was under Homepage). */
export const load: PageServerLoad = async ({ locals, url }) => {
	requireOwner(locals.user, url);
	return { subjects: await listPlatformSubjects(locals.db), done: doneFrom(url) };
};

export const actions: Actions = {
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
		if (f.sure !== 'on') return fail(400, { error: 'err_tick_sure', removeFor: Number(f.id) || 0 });
		const name = await removePlatformSubject(locals.db, Number(f.id) || 0);
		if (!name) return fail(404, { error: 'err_not_found' });
		await audit(locals.db, me.id, 'subject_removed', f.id ?? null, name);
		doneRedirect(url, 'oc_done_subject_removed');
	}
};
