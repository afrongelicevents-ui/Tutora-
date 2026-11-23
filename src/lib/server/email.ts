import type { SendEmail } from './auth-config';

export interface EmailConfig {
	/** Resend API key (needs a verified domain to reach anyone but the account owner). */
	apiKey?: string;
	/** Brevo API key. Used instead of Resend when set; works with a plain Gmail sender. */
	brevoApiKey?: string;
	from?: string;
	production: boolean;
	fetch?: typeof fetch;
}

/** Splits `Tutora <me@gmail.com>` into a name and an address. */
export function parseFrom(from: string | undefined): { name: string; email: string } | undefined {
	if (!from) return undefined;
	const m = from.match(/^\s*(.*?)\s*<\s*([^>\s]+@[^>\s]+)\s*>\s*$/);
	if (m) return { name: m[1] || 'Tutora', email: m[2] };
	const plain = from.trim();
	return plain.includes('@') ? { name: 'Tutora', email: plain } : undefined;
}

/**
 * Sends plain-text email through Brevo (https://brevo.com, free: 300 a day, no domain needed)
 * or Resend (https://resend.com, free tier). Plain text keeps emails tiny for mobile data.
 * Without an API key, emails are printed to the log in development and refused in production.
 */
export function createSendEmail(cfg: EmailConfig): SendEmail {
	const doFetch = cfg.fetch ?? fetch;
	return async ({ to, subject, text }) => {
		if (cfg.brevoApiKey) {
			const sender = parseFrom(cfg.from);
			if (!sender) throw new Error('EMAIL_FROM must be set to a sender address verified in Brevo');
			const res = await doFetch('https://api.brevo.com/v3/smtp/email', {
				method: 'POST',
				headers: {
					'api-key': cfg.brevoApiKey,
					'Content-Type': 'application/json',
					Accept: 'application/json'
				},
				body: JSON.stringify({ sender, to: [{ email: to }], subject, textContent: text })
			});
			if (!res.ok) throw new Error(`Email send failed: ${res.status}`);
			return;
		}
		if (!cfg.apiKey) {
			if (cfg.production) throw new Error('No email key is set; cannot send email');
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
