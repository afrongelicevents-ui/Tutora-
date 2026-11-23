import { describe, expect, it } from 'vitest';
import { cachePolicy } from './sw-policy.ts';

const O = 'https://tutora.example';
const shell = new Set(['/offline', '/icons/icon-192.png', '/manifest.webmanifest']);
const get = (path: string, mode = 'cors') =>
	cachePolicy(new URL(O + path), { method: 'GET', mode }, shell, O);

describe('service worker cache rules', () => {
	it('stores only the app shell', () => {
		expect(get('/_app/immutable/chunks/abc.js')).toBe('cache');
		expect(get('/_app/immutable/assets/app.css')).toBe('cache');
		expect(get('/icons/icon-192.png')).toBe('cache');
		expect(get('/offline')).toBe('cache');
	});

	it('never stores private pages, page data, files, api or payments', () => {
		for (const p of [
			'/student',
			'/parent/billing',
			'/parent/checkout',
			'/student/payments',
			'/tutor/payments/export',
			'/account',
			'/owner/payments'
		])
			expect(get(p, 'navigate')).toBe('network-or-offline');
		for (const p of [
			'/student/__data.json',
			'/api/cron/reminders',
			'/files?k=x&s=y',
			'/parent/billing/3/receipt',
			'/_app/version.json'
		])
			expect(get(p)).toBe('network');
	});

	it('never stores form posts or other sites', () => {
		expect(cachePolicy(new URL(O + '/_app/immutable/x.js'), { method: 'POST' }, shell, O)).toBe(
			'network'
		);
		expect(
			cachePolicy(new URL('https://cdn.example/_app/immutable/x.js'), { method: 'GET' }, shell, O)
		).toBe('network');
	});

	it('a shell path with a query string is not served from the store', () => {
		expect(get('/icons/icon-192.png?v=2')).toBe('network');
	});
});
