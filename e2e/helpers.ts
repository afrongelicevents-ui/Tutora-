import { test, type Browser, type Page } from '@playwright/test';
import pg from 'pg';

export const PW = process.env.E2E_PASSWORD ?? 'Shot-pass-123';

const AUTH_DIR = 'test-results/.auth';

/**
 * A fresh browser context logged in as this test account. The session is kept between tests
 * (one real login per account), because the site itself limits how often anyone may log in.
 */
export async function as(browser: Browser, login: string): Promise<Page> {
	const fs = await import('node:fs');
	// the same screen size as the project running the test (phone or desktop)
	const size = test.info().project.use.viewport ?? { width: 390, height: 844 };
	const file = `${AUTH_DIR}/${login.replace(/[^a-z0-9]/gi, '_')}.json`;
	const saved = fs.existsSync(file) ? file : undefined;
	const ctx = await browser.newContext({ viewport: size, storageState: saved });
	// the "TEST SITE" bar stays visible but never sits in front of a button
	await ctx.addInitScript(() => {
		document.addEventListener('DOMContentLoaded', () => {
			const s = document.createElement('style');
			s.textContent = '.testbar{pointer-events:none}';
			document.head.append(s);
		});
	});
	const page = await ctx.newPage();
	if (saved) {
		await page.goto('/account');
		if (!new URL(page.url()).pathname.startsWith('/login')) return page;
	}
	await page.goto('/login');
	await page.fill('input[name=email], input[name=identifier], input[type=email]', login);
	await page.fill('input[type=password]', PW);
	await page.click('button[type=submit]');
	await page
		.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15_000 })
		.catch(async () => {
			const why = await page.locator('[role=alert]').allTextContents();
			throw new Error(`login as ${login} failed: ${why.join(' ') || 'no message'}`);
		});
	fs.mkdirSync(AUTH_DIR, { recursive: true });
	await ctx.storageState({ path: file });
	return page;
}

/** Submit the form that contains this button (waits for the page to come back). */
export async function press(page: Page, selector: string) {
	const el = page.locator(selector).first();
	await el.waitFor({ state: 'visible', timeout: 15_000 }).catch((e) => {
		throw new Error(`press: "${selector}" not visible on ${page.url()}\n${String(e)}`);
	});
	await Promise.all([page.waitForLoadState('load'), el.click()]);
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

/**
 * Run the hourly job (reminders, check-in notes, summaries) the way the scheduler does.
 * Uses CRON_SECRET from the environment or the local .env (never printed). Returns null when
 * the secret is not set up locally, so a test can say the step was not run.
 */
export async function runCron(page: Page): Promise<Record<string, number> | null> {
	let secret = process.env.CRON_SECRET ?? '';
	if (!secret) {
		const fs = await import('node:fs');
		const text = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
		secret = /^CRON_SECRET=["']?([^"'\n]+)/m.exec(text)?.[1] ?? '';
	}
	if (secret.length < 24) return null;
	const r = await page.request.post('/api/cron/reminders', {
		headers: { authorization: `Bearer ${secret}` }
	});
	if (r.status() !== 200) return null;
	return (await r.json()) as Record<string, number>;
}

/** The bell's unread number as the person sees it (phone header or desktop nav). */
export async function bellCount(page: Page): Promise<number> {
	for (const a of await page.locator('a[href="/notifications"]').all()) {
		if (!(await a.isVisible())) continue;
		const label = (await a.getAttribute('aria-label')) ?? '';
		const fromLabel = /(\d+)\+? new/.exec(label);
		if (fromLabel) return Number(fromLabel[1]);
		const c = a.locator('.count');
		if (await c.count()) return Number((await c.textContent())?.replace('+', '') ?? 0);
		return 0;
	}
	return 0;
}
