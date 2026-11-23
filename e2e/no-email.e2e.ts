import { test, expect, type Page } from '@playwright/test';
import { as, press, sql, closeDb, PW } from './helpers.ts';

/**
 * Tutora with no email service (no domain yet): sign-up goes straight in, nobody is told to
 * check their email, the owner gives one-time reset links (copy / WhatsApp), and receipts
 * reach the bell with "Share on WhatsApp".
 *
 * Runs against a server started with EMAIL_OFF=1 (see e2e/README.md); on a server with email
 * switched on, the email-off checks are skipped.
 */
test.afterAll(closeDb);

async function emailOff(page: Page) {
	await page.goto('/forgot-password');
	return (await page.locator('main').innerText()).includes('reset link');
}

test('sign-up goes straight in, and Forgot password asks for a reset link', async ({ browser }) => {
	const ctx = await browser.newContext();
	const page = await ctx.newPage();
	test.skip(!(await emailOff(page)), 'this server has email switched on');
	await expect(page.locator('main')).not.toContainText(/check your email|we sent/i);
	await expect(page.getByRole('link', { name: 'Contact the Tutora team' })).toBeVisible();
	// no email field to send to
	await expect(page.locator('input[name=email]')).toHaveCount(0);

	await page.goto('/signup');
	await expect(page.locator('main')).not.toContainText(/email you a link/i);
	const email = `noemail-${Date.now()}-${test.info().project.name}@example.com`;
	await page.fill('input[name=name]', 'Farai Test');
	await page.fill('input[name=email]', email);
	await page.fill('input[name=password]', 'a-long-pass-123');
	await page.fill('input[name=phone]', '0771234567');
	await page.locator('input[name=consent]').check({ force: true });
	// the form refuses anything sent within 2 seconds (bot protection)
	await page.waitForTimeout(2_200);
	await Promise.all([
		page.waitForURL((u) => !u.pathname.startsWith('/signup')),
		page.click('button[type=submit]')
	]);
	expect(new URL(page.url()).pathname).not.toBe('/verify-email');
	expect(new URL(page.url()).pathname).not.toBe('/login');
	await ctx.close();
});

test('owner makes a one-time reset link; it works once, for the person it was made for', async ({
	browser
}) => {
	const probe = await (await browser.newContext()).newPage();
	test.skip(!(await emailOff(probe)), 'this server has email switched on');
	await probe.context().close();

	const [kid] = await sql<{ id: string }>(`select id from "user" where email = 'kuda@example.com'`);
	const owner = await as(browser, 'owner@example.com');
	const makeLink = async () => {
		await owner.goto('/owner/students?q=kuda%40example.com');
		const card = owner.locator(`.oa-card[data-person="${kid.id}"]`);
		await press(owner, `.oa-card[data-person="${kid.id}"] form[action="?/resetLink"] button`);
		const box = card.locator('[data-reset-link]');
		await expect(box).toBeVisible();
		const link = await box.locator('input').inputValue();
		expect(link).toMatch(/\/reset\/[A-Za-z0-9_-]{40,}$/);
		const wa = await box.getByRole('link', { name: 'Share on WhatsApp' }).getAttribute('href');
		expect(wa).toMatch(/^https:\/\/wa\.me\/\d*\?text=/);
		expect(decodeURIComponent(wa!.split('text=')[1])).toContain(link);
		return link;
	};
	const link = await makeLink();

	// the person opens it logged out and chooses a new password
	const ctx = await browser.newContext();
	const kidPage = await ctx.newPage();
	await kidPage.goto(link);
	await kidPage.fill('input[name=password]', 'kuda-new-pass-9');
	await kidPage.fill('input[name=confirm]', 'kuda-new-pass-9');
	await Promise.all([kidPage.waitForURL(/\/login\?reset=1/), kidPage.click('button[type=submit]')]);
	await kidPage.fill('input[name=email]', 'kuda@example.com');
	await kidPage.fill('input[type=password]', 'kuda-new-pass-9');
	await Promise.all([
		kidPage.waitForURL((u) => !u.pathname.startsWith('/login')),
		kidPage.click('button[type=submit]')
	]);
	// the link does not work a second time
	const again = await (await browser.newContext()).newPage();
	await again.goto(link);
	await expect(again.locator('main')).toContainText('already been used');
	await expect(again.locator('input[name=password]')).toHaveCount(0);
	await again.context().close();
	await ctx.close();

	// put the test password back for the other flows (with a second link)
	const back = await makeLink();
	const restore = await (await browser.newContext()).newPage();
	await restore.goto(back);
	await restore.fill('input[name=password]', PW);
	await restore.fill('input[name=confirm]', PW);
	await Promise.all([restore.waitForURL(/\/login\?reset=1/), restore.click('button[type=submit]')]);
	await restore.context().close();
});

test('a confirmed payment reaches the bell, and the receipt has Share on WhatsApp', async ({
	browser
}) => {
	// a payment from Nyasha waiting for Chipo (made here if the seed's one was used already)
	let [p] = await sql<{ id: number }>(
		`select p.id from payment p join "user" u on u.id = p.user_id
		 where u.email = 'nyasha@example.com' and p.status = 'pending' order by p.id limit 1`
	);
	if (!p) {
		[p] = await sql<{ id: number }>(
			`insert into payment (tutor_id, user_id, amount_cents, currency, method, status, paid_on, recorded_by)
			 select 'test_chipo', id, 1000, 'USD', 'cash', 'pending', current_date, id
			 from "user" where email = 'nyasha@example.com' returning id`
		);
	}
	const chipo = await as(browser, 'chipo@example.com');
	await chipo.goto('/tutor/payments');
	await press(chipo, `form[action="?/confirmPayment"]:has(input[value="${p.id}"]) button`);
	const [{ receipt_no }] = await sql<{ receipt_no: number }>(
		'select receipt_no from payment where id = $1',
		[p.id]
	);
	expect(receipt_no).toBeTruthy();

	const nyasha = await as(browser, 'nyasha@example.com');
	await nyasha.goto('/notifications');
	await expect(nyasha.locator('main')).toContainText('Payment confirmed – receipt');
	await nyasha.goto('/student/payments?tab=history');
	const share = nyasha.getByRole('link', { name: 'Share on WhatsApp' }).first();
	await expect(share).toBeVisible();
	const text = decodeURIComponent((await share.getAttribute('href'))!.split('text=')[1]);
	expect(text).toMatch(/^Receipt .+ from .+ · \$\d+\.\d\d · /);
	expect(text).toContain('/student/payments');
});
