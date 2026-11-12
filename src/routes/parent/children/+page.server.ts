import { fail, redirect } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { requireRole } from '#lib/server/guards.ts';
import {
	childrenOf,
	decidePending,
	FamilyFail,
	guardianPermissions,
	kidUsername,
	previewInvite,
	removeLink,
	setGuardianPermissions
} from '#lib/server/family.ts';
import { createChildAccount, setChildLogin } from '#lib/server/family-accounts.ts';
import { rememberCode } from '#lib/server/family-code.ts';
import { clientIp, hitLimit } from '#lib/server/rate-limit.ts';
import { familyLink } from '#lib/server/db/v3.schema.ts';
import { user } from '#lib/server/db/auth.schema.ts';
import { formObject } from '#lib/validation/auth.ts';
import { shortName } from '#lib/names.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	const u = requireRole(locals.user, url, ['parent']);
	const kids = await childrenOf(locals.db, u.id);
	const details = await Promise.all(
		kids.map(async (k) => {
			const [acc] = await locals.db
				.select({ email: user.email })
				.from(user)
				.where(eq(user.id, k.studentId));
			const pending =
				k.guardian && k.status === 'active'
					? await locals.db
							.select({ parentId: familyLink.parentId, name: user.name })
							.from(familyLink)
							.innerJoin(user, eq(user.id, familyLink.parentId))
							.where(
								and(
									eq(familyLink.studentId, k.studentId),
									eq(familyLink.status, 'pending_guardian')
								)
							)
					: [];
			return {
				id: k.studentId,
				name: k.name,
				short: shortName(k.name),
				level: k.level,
				status: k.status,
				guardian: k.guardian,
				managed: !!k.managed,
				isUnder18: !!k.isUnder18,
				username: k.managed ? kidUsername(acc?.email ?? '') : null,
				perms: k.guardian && k.isUnder18 ? await guardianPermissions(locals.db, k.studentId) : null,
				pending: pending.map((p: { parentId: string; name: string }) => ({
					parentId: p.parentId,
					name: p.name
				}))
			};
		})
	);
	return { kids: details };
};

const fam = async (fn: () => Promise<unknown>) => {
	try {
		await fn();
		return null;
	} catch (e) {
		if (e instanceof FamilyFail) return fail(400, { error: e.code });
		throw e;
	}
};

export const actions: Actions = {
	/** Another child's code: check it, then confirm on /code/connect. */
	code: async ({ locals, url, request, cookies }) => {
		requireRole(locals.user, url, ['parent']);
		const code = String((await request.formData()).get('code') ?? '').slice(0, 40);
		const limit = await hitLimit(locals.db, 'familyCode', clientIp(request));
		if (!limit.ok) return fail(429, { error: 'err_rate_limited', code });
		if (!(await previewInvite(locals.db, code))) return fail(400, { error: 'v3_code_bad', code });
		rememberCode(cookies, code);
		redirect(303, '/code/connect');
	},
	createChild: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['parent']);
		const f = formObject(await request.formData());
		const limit = await hitLimit(locals.db, 'signup', `child:${u.id}`);
		if (!limit.ok) return fail(429, { error: 'err_rate_limited' });
		try {
			const r = await createChildAccount({ auth: locals.auth, db: locals.db }, u.id, {
				name: f.name ?? '',
				username: f.username ?? '',
				password: f.password ?? '',
				level: f.level,
				year: f.year
			});
			if (!r.ok)
				return fail(400, {
					create: { name: f.name, username: f.username, level: f.level, year: f.year },
					errors: r.errors
				});
			return { created: r.username };
		} catch (e) {
			if (e instanceof FamilyFail) return fail(400, { error: e.code });
			throw e;
		}
	},
	login: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['parent']);
		const f = formObject(await request.formData());
		try {
			const r = await setChildLogin({ auth: locals.auth, db: locals.db }, u.id, f.child ?? '', {
				username: f.username ?? '',
				password: f.password ?? ''
			});
			if (!r.ok) return fail(400, { loginFor: f.child, errors: r.errors });
			return { loginSet: r.username };
		} catch (e) {
			if (e instanceof FamilyFail) return fail(400, { error: e.code });
			throw e;
		}
	},
	decide: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['parent']);
		const f = formObject(await request.formData());
		return (
			(await fam(() =>
				decidePending(locals.db, u.id, f.child ?? '', f.parent ?? '', f.allow === '1')
			)) ?? { decided: true }
		);
	},
	perms: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['parent']);
		const f = formObject(await request.formData());
		return (
			(await fam(() =>
				setGuardianPermissions(locals.db, u.id, f.child ?? '', {
					toolsAllowed: f.tools === 'on',
					approveNewFamily: f.approve === 'on'
				})
			)) ?? { permsSaved: true }
		);
	},
	leave: async ({ locals, url, request }) => {
		const u = requireRole(locals.user, url, ['parent']);
		const f = formObject(await request.formData());
		return (
			(await fam(() =>
				removeLink(locals.db, { role: 'parent', id: u.id }, f.child ?? '', u.id)
			)) ?? { left: true }
		);
	}
};
