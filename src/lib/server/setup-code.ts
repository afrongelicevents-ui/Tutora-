import { eq, gt, and } from 'drizzle-orm';
import type { DB } from './db/types.ts';
import { setupCode } from './db/schema.ts';

/** Same rules as scripts/deploy/setup-code.mjs: ignore case, spaces and dashes. */
export function normalizeCode(code: string): string {
	return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function sha256(text: string): Promise<string> {
	const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
}

function sameText(a: string, b: string) {
	if (a.length !== b.length) return false;
	let r = 0;
	for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return r === 0;
}

/** Is there a code waiting to be used? */
export async function hasSetupCode(db: DB): Promise<boolean> {
	const rows = await db
		.select({ id: setupCode.id })
		.from(setupCode)
		.where(gt(setupCode.expiresAt, new Date()));
	return rows.length > 0;
}

/** True if the code matches the stored, unexpired one. */
export async function checkSetupCode(db: DB, code: string): Promise<boolean> {
	const plain = normalizeCode(code);
	if (plain.length < 8) return false;
	const [row] = await db
		.select()
		.from(setupCode)
		.where(and(eq(setupCode.id, 1), gt(setupCode.expiresAt, new Date())));
	return !!row && sameText(row.codeHash, await sha256(plain));
}

/** The code has been used: remove it so it never works again. */
export async function useUpSetupCode(db: DB) {
	await db.delete(setupCode);
}

/** Makes a fresh code (tests and local development; production codes come from the deploy). */
export async function createSetupCode(db: DB, days = 14): Promise<string> {
	const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
	const bytes = crypto.getRandomValues(new Uint8Array(12));
	const raw = Array.from(bytes, (b) => abc[b % abc.length]).join('');
	const code = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
	const values = {
		codeHash: await sha256(normalizeCode(code)),
		expiresAt: new Date(Date.now() + days * 86400_000)
	};
	await db
		.insert(setupCode)
		.values({ id: 1, ...values })
		.onConflictDoUpdate({ target: setupCode.id, set: values });
	return code;
}
