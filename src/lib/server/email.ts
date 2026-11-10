import type { SendEmail } from './auth-config';

export interface EmailConfig {
	apiKey?: string;
	from?: string;
	production: boolean;
	fetch?: typeof fetch;
}

/**
 * Sends plain-text email through Resend (https://resend.com, free tier).
 * Plain text keeps emails tiny for mobile data.
 * Without an API key, emails are printed to the log in development and refused in production.
 */
export function createSendEmail(cfg: EmailConfig): SendEmail {
	const doFetch = cfg.fetch ?? fetch;
	return async ({ to, subject, text }) => {
		if (!cfg.apiKey) {
			if (cfg.production) throw new Error('RESEND_API_KEY is not set; cannot send email');
			console.info(`\n[email] to=${to}\n[email] subject=${subject}\n${text}\n`);
			return;
		}
		const res = await doFetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				from: cfg.from ?? 'Tutora <onboarding@resend.dev>',
				to,
				subject,
				text
			})
		});
		if (!res.ok) throw new Error(`Email send failed: ${res.status}`);
	};
}
