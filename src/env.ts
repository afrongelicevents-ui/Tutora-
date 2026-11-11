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
	TUTOR_EMAIL: {
		description:
			'Optional. If set, the tutor claims the site at /setup with a link sent to this address. If empty, the first person to complete /setup becomes the tutor (do it right after the first deploy).',
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
	EMAIL_FROM: {
		description: 'Sender address for emails, e.g. `Tutora <hello@tutora.co.zw>`.',
		schema: optional
	}
});
