import { ORIGIN, BETTER_AUTH_SECRET, RESEND_API_KEY, EMAIL_FROM } from '$app/env/private';
import { dev } from '$app/env';
import { getRequestEvent } from '$app/server';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import type { DB } from './db/types';
import { createAuth } from './auth-config';
import { createSendEmail } from './email';

/** Emails work in development (printed to the log) or when a Resend key is set. */
export const emailEnabled = dev || !!RESEND_API_KEY;

const send = createSendEmail({ apiKey: RESEND_API_KEY, from: EMAIL_FROM, production: !dev });
/** Sends an email if an email service is set up; otherwise does nothing. */
export const sendEmail: typeof send = async (msg) => {
	if (emailEnabled) await send(msg);
};

/** Better Auth bound to this request's database connection. */
export function makeAuth(db: DB) {
	return createAuth({
		db,
		baseURL: ORIGIN,
		secret: BETTER_AUTH_SECRET,
		sendEmail,
		emailEnabled,
		transactions: true,
		production: !dev,
		plugins: [sveltekitCookies(getRequestEvent)] // must stay last
	});
}
