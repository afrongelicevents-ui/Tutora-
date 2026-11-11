import {
	ORIGIN,
	BETTER_AUTH_SECRET,
	TUTOR_EMAIL,
	RESEND_API_KEY,
	EMAIL_FROM
} from '$app/env/private';
import { dev } from '$app/env';
import { getRequestEvent } from '$app/server';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import type { DB } from './db/types';
import { createAuth } from './auth-config';
import { createSendEmail } from './email';

export const sendEmail = createSendEmail({
	apiKey: RESEND_API_KEY,
	from: EMAIL_FROM,
	production: !dev
});

/** Better Auth bound to this request's database connection. */
export function makeAuth(db: DB) {
	return createAuth({
		db,
		baseURL: ORIGIN,
		secret: BETTER_AUTH_SECRET,
		tutorEmail: TUTOR_EMAIL,
		sendEmail,
		transactions: true,
		production: !dev,
		plugins: [sveltekitCookies(getRequestEvent)] // must stay last
	});
}
