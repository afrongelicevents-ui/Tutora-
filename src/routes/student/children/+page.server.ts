import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import { addChild, myChildren, removeChild } from '#lib/server/student.ts';
import { fieldErrors, formObject } from '#lib/validation/auth.ts';

/** A parent's children (never shown publicly). */
export const load: PageServerLoad = async ({ locals, url }) => {
	const u = requireRole(locals.user, url, ['parent']);
	return { children: await myChildren(locals.db, u.id) };
};

const schema = z.object({
	name: z.string().trim().min(2, 'err_name').max(80, 'err_too_long'),
	level: z.string().trim().max(60, 'err_too_long').optional(),
	schoolYear: z.string().trim().max(40, 'err_too_long').optional()
});

export const actions: Actions = {
	add: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['parent']);
		const p = schema.safeParse(formObject(await request.formData()));
		if (!p.success) return fail(400, { errors: fieldErrors(p.error) });
		if ((await myChildren(locals.db, u.id)).length >= 10)
			return fail(400, { errors: { name: 'err_too_many' } });
		await addChild(locals.db, u.id, {
			name: p.data.name,
			level: p.data.level || null,
			schoolYear: p.data.schoolYear || null
		});
		return { saved: true };
	},
	remove: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['parent']);
		const f = formObject(await request.formData());
		await removeChild(locals.db, u.id, Number(f.id) || 0);
		return { saved: true };
	}
};
