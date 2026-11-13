import type { Browser, Page } from '@playwright/test';
import pg from 'pg';

export const PW = process.env.E2E_PASSWORD ?? 'Shot-pass-123';

/** A fresh browser context logged in as this test account. */
export async function as(browser: Browser, login: string): Promise<Page> {
	const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
	// the "TEST SITE" bar stays visible but never sits in front of a button
	await ctx.addInitScript(() => {
		document.addEventListener('DOMContentLoaded', () => {
			const s = document.createElement('style');
			s.textContent = '.testbar{pointer-events:none}';
			document.head.append(s);
		});
	});
	const page = await ctx.newPage();
	await page.goto('/login');
	await page.fill('input[name=email], input[name=identifier], input[type=email]', login);
	await page.fill('input[type=password]', PW);
	await Promise.all([
		page.waitForURL((u) => !u.pathname.startsWith('/login')),
		page.click('button[type=submit]')
	]);
	return page;
}

/** Submit the form that contains this button (waits for the page to come back). */
export async function press(page: Page, selector: string) {
	await Promise.all([page.waitForLoadState('load'), page.locator(selector).first().click()]);
	await page.waitForLoadState('networkidle').catch(() => {});
}

/** Tick a radio or checkbox that is styled as a chip (the input itself is hidden). */
export async function pick(page: Page, selector: string) {
	await page.locator(selector).first().check({ force: true });
}

let pool: pg.Pool | null = null;
/** Direct database access for moving time forward in a test (never used for checking). */
export async function sql<T = Record<string, unknown>>(q: string, params: unknown[] = []) {
	pool ??= new pg.Pool({
		connectionString: process.env.E2E_DB ?? 'postgres://tutora:tutora@localhost:5432/tutora_shot',
		max: 2
	});
	return (await pool.query(q, params)).rows as T[];
}

export async function closeDb() {
	await pool?.end();
	pool = null;
}

export const uniq = () => Math.random().toString(36).slice(2, 7);
