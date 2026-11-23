import {
	ORIGIN,
	BETTER_AUTH_SECRET,
	RESEND_API_KEY,
	BREVO_API_KEY,
	EMAIL_FROM
} from '$app/env/private';
import { dev } from '$app/env';
import { getRequestEvent } from '$app/server';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import type { DB } from './db/types';
import { createAuth } from './auth-config';
import { createSendEmail } from './email';

/** Emails work in development (printed to the log) or when a Brevo or Resend key is set. */
export const emailEnabled = dev || !!BREVO_API_KEY || !!RESEND_API_KEY;

const send = createSendEmail({
	apiKey: RESEND_API_KEY,
	brevoApiKey: BREVO_API_KEY,
	from: EMAIL_FROM,
	production: !dev
});
/** Sends an email if an email service is set up; otherwise does nothing. */
export const sendEmail: typeof send = async (msg) => {
	if (emailEnabled) await send(msg);
};

/**
 * The request's own database, looked up when Better Auth uses it. Better Auth is then built
 * once per worker instead of once per request (building it costs several milliseconds of
 * CPU: schema checks, option parsing), while every query still runs on the current
 * request's connection.
 */
const requestDb = new Proxy({} as DB, {
	get(_t, key) {
		const db = getRequestEvent().locals.db as unknown as Record<PropertyKey, unknown>;
		const v = db[key];
		return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(db) : v;
	}
});

let shared: ReturnType<typeof createAuth> | null = null;

/** Better Auth for this request (same instance for the worker; see `requestDb`). */
export function makeAuth(_db: DB) {
	shared ??= createAuth({
		db: requestDb,
		// the site's own address: from ORIGIN, else from the request that builds it (the same site)
		baseURL: ORIGIN || getRequestEvent().url.origin,
		secret: BETTER_AUTH_SECRET,
		sendEmail,
		emailEnabled,
		transactions: true,
		production: !dev,
		plugins: [sveltekitCookies(getRequestEvent)] // must stay last
	});
	return shared;
}
