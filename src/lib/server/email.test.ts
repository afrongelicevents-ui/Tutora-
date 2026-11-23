import { describe, expect, it, vi } from 'vitest';
import { createSendEmail, parseFrom } from './email';

describe('parseFrom', () => {
	it('reads name and address', () => {
		expect(parseFrom('Tutora <tutora.app@gmail.com>')).toEqual({
			name: 'Tutora',
			email: 'tutora.app@gmail.com'
		});
		expect(parseFrom('tutora.app@gmail.com')).toEqual({
			name: 'Tutora',
			email: 'tutora.app@gmail.com'
		});
		expect(parseFrom(undefined)).toBeUndefined();
		expect(parseFrom('nope')).toBeUndefined();
	});
});

describe('createSendEmail', () => {
	it('uses Brevo when a Brevo key is set', async () => {
		const fetch = vi.fn(async () => new Response('{}', { status: 201 }));
		const send = createSendEmail({
			brevoApiKey: 'k',
			apiKey: 'resend',
			from: 'Tutora <t@gmail.com>',
			production: true,
			fetch: fetch as unknown as typeof globalThis.fetch
		});
		await send({ to: 'p@example.com', subject: 'Hi', text: 'Body' });
		const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe('https://api.brevo.com/v3/smtp/email');
		expect((init.headers as Record<string, string>)['api-key']).toBe('k');
		expect(JSON.parse(init.body as string)).toEqual({
			sender: { name: 'Tutora', email: 't@gmail.com' },
			to: [{ email: 'p@example.com' }],
			subject: 'Hi',
			textContent: 'Body'
		});
	});

	it('needs a sender for Brevo', async () => {
		const send = createSendEmail({ brevoApiKey: 'k', production: true });
		await expect(send({ to: 'a@b.c', subject: 's', text: 't' })).rejects.toThrow(/EMAIL_FROM/);
	});

	it('fails loudly when Brevo refuses', async () => {
		const fetch = vi.fn(async () => new Response('no', { status: 401 }));
		const send = createSendEmail({
			brevoApiKey: 'k',
			from: 't@gmail.com',
			production: true,
			fetch: fetch as unknown as typeof globalThis.fetch
		});
		await expect(send({ to: 'a@b.c', subject: 's', text: 't' })).rejects.toThrow(/401/);
	});
});
