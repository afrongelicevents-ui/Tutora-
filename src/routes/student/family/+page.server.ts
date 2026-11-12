import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import {
	activeInvite,
	createInvite,
	familyOf,
	FamilyFail,
	removeLink,
	revokeInvites,
	setSharing
} from '#lib/server/family.ts';
import { profile } from '#lib/server/db/app.schema.ts';
import { hitLimit } from '#lib/server/rate-limit.ts';
import { formObject } from '#lib/validation/auth.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	const u = requireRole(locals.user, url, ['student']);
	const fam = await familyOf(locals.db, u.id);
	const invite = await activeInvite(locals.db, u.id);
	const [prof] = await locals.db
		.select({ isUnder18: profile.isUnder18 })
		.from(profile)
		.where(eq(profile.userId, u.id));
	const minor = !!prof?.isUnder18;
	return {
		minor,
		invite: invite ? { hint: invite.hint, expiresAt: invite.expiresAt } : null,
		family: fam.map((f) => ({
			parentId: f.parentId,
			name: f.name,
			label: f.label,
			guardian: f.guardian,
			status: f.status,
			// a guardian of a child under 18 always sees the basics
			locked: f.guardian && minor,
			progress: f.shareProgress,
			lessons: f.shareLessons,
			homework: f.shareHomework,
			study: f.shareStudy
		}))
	};
};

export const actions: Actions = {
	/** A new one-time code (any unused code stops working). Shown once. */
	invite: async ({ locals, url }) => {
		const u = requireRole(locals.user, url, ['student']);
		const limit = await hitLimit(locals.db, 'familyInvite', u.id);
		if (!limit.ok)
			return fail(429, {
				error: 'err_rate_limited',
				minutes: Math.ceil(limit.retryAfterSeconds / 60)
			});
		const { code, expiresAt } = await createInvite(locals.db, u.id);
		return { code, expiresAt };
	},
	revoke: async ({ locals, url }) => {
		const u = requireRole(locals.user, url, ['student']);
		await revokeInvites(locals.db, u.id);
		return { revoked: true };
	},
	share: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['student']);
		const f = formObject(await request.formData());
		try {
			await setSharing(locals.db, u.id, f.parentId ?? '', {
				progress: f.progress === 'on',
				lessons: f.lessons === 'on',
				homework: f.homework === 'on',
				study: f.study === 'on',
				label: (f.label ?? '').trim().slice(0, 30) || null
			});
		} catch (e) {
			if (e instanceof FamilyFail) return fail(400, { error: e.code });
			throw e;
		}
		return { shared: true };
	},
	remove: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['student']);
		const f = formObject(await request.formData());
		try {
			await removeLink(locals.db, { role: 'student', id: u.id }, u.id, f.parentId ?? '');
		} catch (e) {
			if (e instanceof FamilyFail) return fail(400, { error: e.code });
			throw e;
		}
		return { removed: true };
	}
};
