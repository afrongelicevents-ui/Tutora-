import { expect, test } from '@playwright/test';
import { as } from './helpers.ts';

// The service worker itself only runs in the production build: see scripts/pwa-check.mjs.
// Here: the manifest, the start page, the offline page and where "Install Tutora" shows.

test('manifest, start page and offline page', async ({ page, request }) => {
	const m = await (await request.get('/manifest.webmanifest')).json();
	expect(m.start_url).toBe('/app?source=pwa');
	const r = await request.get('/app?source=pwa', { maxRedirects: 0 });
	expect(r.status()).toBe(303);
	expect(r.headers().location).toBe('/login?next=%2Fapp');
	await page.goto('/offline.html');
	await expect(page.getByRole('heading', { name: "You're offline" })).toBeVisible();
	await page.goto('/');
	await expect(page.locator('link[rel=manifest]')).toHaveAttribute('href', '/manifest.webmanifest');
	await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute(
		'content',
		'yes'
	);
});

test('the installed app opens on each person’s own home page', async ({ browser }) => {
	for (const [email, home] of [
		['nyasha@example.com', '/student'],
		['sibanda@example.com', '/parent'],
		['chipo@example.com', '/tutor']
	]) {
		const p = await as(browser, email);
		await p.goto('/app?source=pwa');
		await expect(p).toHaveURL(new RegExp(`${home}$`));
	}
});

test('iPhone: the install card shows once on home, the steps open; the menu item stays', async ({
	browser
}) => {
	const p = await as(browser, 'nyasha@example.com');
	await p.addInitScript(() => {
		Object.defineProperty(navigator, 'userAgent', {
			get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1'
		});
	});
	await p.evaluate(() => localStorage.removeItem('tutora-install-dismissed'));
	await p.goto('/student');
	const card = p.locator('[data-install-card]');
	await expect(card).toBeVisible();
	await card.locator('[data-install-btn]').click();
	await expect(p.locator('dialog[data-install-ios]').first()).toBeVisible();
	await p.locator('dialog[data-install-ios] [data-install-ios-close]').first().click();
	// once: not again on the next visit
	await p.goto('/student');
	await expect(card).toBeHidden();
	// the account menu always has it
	await p.goto('/account');
	await expect(p.locator('[data-install-item] [data-install-btn]')).toBeVisible();
});

test('a browser that cannot install shows the written steps, never a dead button', async ({
	browser
}) => {
	const p = await as(browser, 'sibanda@example.com');
	await p.goto('/parent/settings');
	const item = p.locator('[data-install-item]');
	await expect(item).toBeVisible();
	await expect(item.locator('[data-install-help]')).toBeVisible();
	await expect(item.locator('[data-install-btn]')).toBeHidden();
	await p.goto('/parent');
	await expect(p.locator('[data-install-card]')).toBeHidden();
});
