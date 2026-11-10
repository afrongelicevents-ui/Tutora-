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
			'Public base URL of the site, e.g. `https://tutora.co.zw`. Kept configurable until the domain is bought.',
		schema: z.url()
	},
	BETTER_AUTH_SECRET: {
		description: 'Secret used to sign sessions. At least 32 random characters.',
		schema: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters')
	},
	TUTOR_EMAIL: {
		description:
			'Email address of the tutor. The account that signs up and verifies this address becomes the tutor (admin).',
		schema: z.email()
	},
	RESEND_API_KEY: {
		description:
			'Resend API key for sending emails. If empty, emails are printed to the server log (development only).',
		schema: optional
	},
	EMAIL_FROM: {
		description: 'Sender address for emails, e.g. `Tutora <hello@tutora.co.zw>`.',
		schema: optional
	}
});
