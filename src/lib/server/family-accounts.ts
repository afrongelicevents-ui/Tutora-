/**
 * Younger children's accounts, made and managed by a parent or guardian. They log in with a
 * username (no email needed); the guardian sets and resets the password.
 */
import { and, eq } from 'drizzle-orm';
import type { Auth } from './auth-config.ts';
import type { DB } from './db/types.ts';
import { account, session, user } from './db/auth.schema.ts';
import { profile } from './db/app.schema.ts';
import { familyLink, schoolInfo } from './db/v3.schema.ts';
import { FamilyFail, parentAccess, usernameEmail, usernameRe } from './family.ts';

export interface ChildInput {
	name: string;
	username: string;
	password: string;
	level?: string | null;
	year?: string | null;
}

function check(v: { name?: string; username: string; password: string }) {
	const errors: Record<string, string> = {};
	const username = v.username.trim().toLowerCase();
	if (v.name !== undefined && v.name.trim().length < 2) errors.name = 'err_name';
	if (!usernameRe.test(username) || username.startsWith('child-')) errors.username = 'err_username';
	if (v.password.length < 10) errors.password = 'err_password_short';
	else if (v.password.length > 128) errors.password = 'err_too_long';
	return { username, errors };
}

/** A parent makes an account for a younger child and becomes their guardian. */
export async function createChildAccount(
	deps: { auth: Auth; db: DB },
	parentId: string,
	v: ChildInput
) {
	const { db, auth } = deps;
	const [p] = await db
		.select({ role: user.role, name: user.name, email: user.email, phone: profile.phone })
		.from(user)
		.leftJoin(profile, eq(profile.userId, user.id))
		.where(eq(user.id, parentId));
	if (!p || p.role !== 'parent') throw new FamilyFail('fam_err_not_parent');
	const { username, errors } = check(v);
	if (Object.keys(errors).length) return { ok: false as const, errors };
	const ctx = await auth.$context;
	const email = usernameEmail(username);
	if (await ctx.internalAdapter.findUserByEmail(email))
		return { ok: false as const, errors: { username: 'fam_err_username_taken' } };
	const u = await ctx.internalAdapter.createUser(
		{ name: v.name.trim().slice(0, 80), email, emailVerified: true },
		{ method: 'email-password' }
	);
	await ctx.internalAdapter.linkAccount({
		userId: u.id,
		providerId: 'credential',
		accountId: u.id,
		password: await ctx.password.hash(v.password)
	});
	await db.update(user).set({ role: 'student' }).where(eq(user.id, u.id));
	await db.insert(profile).values({
		userId: u.id,
		isUnder18: !!p.phone,
		parentName: p.name,
		parentPhone: p.phone,
		parentEmail: p.email,
		level: v.level?.trim().slice(0, 40) || null,
		managed: true,
		consentAt: new Date()
	});
	if (v.year?.trim())
		await db
			.insert(schoolInfo)
			.values({ studentId: u.id, year: v.year.trim().slice(0, 40), enteredBy: parentId });
	await db
		.insert(familyLink)
		.values({ parentId, studentId: u.id, guardian: true, status: 'active' });
	return { ok: true as const, studentId: u.id, username };
}

async function guardianOfManaged(db: DB, parentId: string, studentId: string) {
	const a = await parentAccess(db, parentId, studentId);
	if (!a.ok || !a.guardian) throw new FamilyFail('err_not_found');
	const [prof] = await db
		.select({ managed: profile.managed })
		.from(profile)
		.where(eq(profile.userId, studentId));
	if (!prof?.managed) throw new FamilyFail('err_not_found');
}

/**
 * The guardian gives a younger child (e.g. one moved over from the old parent accounts) a
 * username and password, or changes them. Logs the child out everywhere.
 */
export async function setChildLogin(
	deps: { auth: Auth; db: DB },
	parentId: string,
	studentId: string,
	v: { username: string; password: string }
) {
	const { db, auth } = deps;
	await guardianOfManaged(db, parentId, studentId);
	const { username, errors } = check(v);
	if (Object.keys(errors).length) return { ok: false as const, errors };
	const email = usernameEmail(username);
	const [taken] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
	if (taken && taken.id !== studentId)
		return { ok: false as const, errors: { username: 'fam_err_username_taken' } };
	const ctx = await auth.$context;
	const hash = await ctx.password.hash(v.password);
	await db.update(user).set({ email, emailVerified: true }).where(eq(user.id, studentId));
	const updated = await db
		.update(account)
		.set({ password: hash, updatedAt: new Date() })
		.where(and(eq(account.userId, studentId), eq(account.providerId, 'credential')))
		.returning({ id: account.id });
	if (!updated.length)
		await db.insert(account).values({
			id: `acc_${studentId}`,
			userId: studentId,
			accountId: studentId,
			providerId: 'credential',
			password: hash
		});
	await db.delete(session).where(eq(session.userId, studentId));
	return { ok: true as const, username };
}
