import { defineEnvVars } from '@sveltejs/kit/env';
import { z } from 'zod';

const optional = z
	.string()
	.optional()
	.transform((v) => (v ? v : undefined));

export const variables = defineEnvVars({
	DATABASE_URL: {
		description: 'Postgres connection string (Neon in production, local Postgres for development).',
		schema: z.string().min(1, 'DATABASE_URL is not set')
	},
	ORIGIN: {
		description:
			'Optional. Public base URL of the site, e.g. `https://tutora.co.zw`. If empty, the address the site is opened on is used.',
		schema: optional.refine(
			(v) => v === undefined || z.url().safeParse(v).success,
			'ORIGIN must be a URL'
		)
	},
	BETTER_AUTH_SECRET: {
		description: 'Secret used to sign sessions. At least 32 random characters.',
		schema: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters')
	},
	TEST_SITE: {
		description:
			'Optional. "1" on the test site only: shows the "TEST SITE" bar, allows the owner to reset the fake data, and skips the authenticator step so test logins work.',
		schema: optional
	},
	TEST_PASSWORD: {
		description:
			'Test site only: the shared password of all fake test logins (made by the deploy workflow).',
		schema: optional
	},
	RESEND_API_KEY: {
		description:
			'Optional. Resend API key for sending emails. Without it the site works without emails: no email confirmation, no reminder or receipt emails.',
		schema: optional
	},
	CRON_SECRET: {
		description:
			'Optional. Long random text; the hourly reminder job must send it. Reminders are off without it.',
		schema: optional
	},
	TURN_KEY_ID: {
		description:
			'Optional. Cloudflare Realtime TURN key id, for calls on networks that block direct connections.',
		schema: optional
	},
	TURN_KEY_API_TOKEN: {
		description: 'Optional. Cloudflare Realtime TURN key API token (secret).',
		schema: optional
	},
	GOOGLE_CLIENT_ID: {
		description:
			'Optional. Google OAuth client id (Connected Tools: Google Meet links and Google Drive files). See docs/CONNECTED-TOOLS.md.',
		schema: optional
	},
	GOOGLE_CLIENT_SECRET: {
		description: 'Optional. Google OAuth client secret (secret).',
		schema: optional
	},
	GOOGLE_API_KEY: {
		description:
			'Optional. Google API key restricted to the Picker API and this site (used in the browser by the Drive file picker).',
		schema: optional
	},
	GOOGLE_APP_ID: {
		description: 'Optional. Google Cloud project number (the Drive file picker needs it).',
		schema: optional
	},
	MS_CLIENT_ID: {
		description:
			'Optional. Microsoft Entra app (client) id (Connected Tools: Microsoft Teams meetings).',
		schema: optional
	},
	MS_CLIENT_SECRET: {
		description: 'Optional. Microsoft Entra client secret (secret).',
		schema: optional
	},
	TOOLS_KEY: {
		description:
			'Optional. At least 32 random characters used to encrypt connected-tool tokens. If empty, a key is derived from BETTER_AUTH_SECRET.',
		schema: optional
	},
	EMAIL_FROM: {
		description: 'Sender address for emails, e.g. `Tutora <hello@tutora.co.zw>`.',
		schema: optional
	}
});
