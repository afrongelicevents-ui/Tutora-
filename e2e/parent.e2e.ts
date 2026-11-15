// The parent side: every page with one child (Mrs Sibanda → Tatenda) and with two children
// (Mrs Zulu → Anesu and Tafara). Presses the buttons a parent would, at phone and desktop size.
import { expect, test, type Page } from '@playwright/test';
import { as, closeDb, press, sql } from './helpers.ts';

test.afterAll(closeDb);

async function ok(page: Page, path: string) {
	const r = await page.goto(path);
	expect(r?.status(), path).toBe(200);
	// nothing wider than the screen
	const w = await page.evaluate(() => document.documentElement.scrollWidth);
	expect(w).toBeLessThanOrEqual((page.viewportSize()?.width ?? 1280) + 2);
}

test('one child: home, child, tutors, progress, settings, notifications', async ({ browser }) => {
	const p = await as(browser, 'sibanda@example.com');

	// Home: one child card, the family overview, quick actions
	await ok(p, '/parent');
	await expect(p.locator('h1')).toContainText(/Good (morning|afternoon|evening)/);
	await expect(p.getByTestId('child-card')).toHaveCount(1);
	await expect(p.getByTestId('child-card')).toContainText('Tatenda');
	await expect(p.getByRole('heading', { name: 'Your child' })).toBeVisible();

	// View child → the child's own page
	await p
		.getByTestId('child-card')
		.getByRole('link', { name: /View Tatenda/ })
		.click();
	await expect(p).toHaveURL(/\/parent\/child\/test_tatenda/);
	await expect(p.locator('section#lessons')).toBeVisible();
	await expect(p.getByRole('heading', { name: 'Shared check-ins' })).toBeVisible();

	// quick actions and tabs all open
	for (const path of ['/parent/tutors', '/parent/progress', '/parent/school-plus'])
		await ok(p, path);
	await ok(p, '/parent/tutors');
	await expect(p.locator('section#find')).toBeVisible();
	await p.locator('section#find a', { hasText: 'Find a tutor for' }).first().click();
	await expect(p).toHaveURL(/\/parent\/book\?child=test_tatenda/);

	// Progress shows the child's learning
	await ok(p, '/parent/progress');
	await expect(p.getByRole('heading', { name: 'Learning' })).toBeVisible();

	// Settings: save alerts (a notice), stop following needs "I'm sure"
	await ok(p, '/parent/settings');
	await press(p, '#notifications button[type=submit]');
	await expect(p.locator('.notice')).toContainText('Saved');
	await p.locator('details.leave summary').first().click();
	await press(p, 'details.leave form button[type=submit]');
	await expect(p.locator('.alert')).toContainText("I'm sure");
	const [link] = await sql<{ n: number }>(
		`select count(*)::int n from family_link where parent_id = 'test_sibanda' and student_id = 'test_tatenda' and status = 'active'`
	);
	expect(link.n).toBe(1);

	// Notifications (the bell) mark what they show as read
	await ok(p, '/parent/notifications');
	await expect(p.getByRole('heading', { name: 'Recent activity' })).toBeVisible();
	const [unread] = await sql<{ n: number }>(
		`select count(*)::int n from notification where user_id = 'test_sibanda' and read_at is null and id in (select id from notification where user_id = 'test_sibanda' order by created_at desc, id desc limit 50)`
	);
	expect(unread.n).toBe(0);

	// old addresses still work
	await p.goto('/parent/children');
	await expect(p).toHaveURL(/\/parent\/settings/);
	await p.goto('/parent/updates');
	await expect(p).toHaveURL(/\/parent\/notifications/);
	await p.goto('/parent?child=test_tatenda');
	await expect(p).toHaveURL(/\/parent\/child\/test_tatenda/);
});

test('two children: both cards, switching child, settings for each', async ({ browser }) => {
	const p = await as(browser, 'grace@example.com');
	await ok(p, '/parent');
	await expect(p.getByRole('heading', { name: 'Your children' })).toBeVisible();
	await expect(p.getByTestId('child-card')).toHaveCount(2);

	const kids = await sql<{ id: string }>(
		`select student_id id from family_link where parent_id = 'test_grace' and status = 'active' order by student_id`
	);
	for (const k of kids) await ok(p, `/parent/child/${k.id}`);

	// Progress: switch between the two children with the chips
	await ok(p, '/parent/progress');
	const chips = p.locator('nav.chips a.chip:not(.add)');
	await expect(chips).toHaveCount(2);
	const second = (await chips.nth(1).textContent())?.split('·')[0].trim() ?? '';
	await chips.nth(1).click();
	await expect(p.locator('header.who h2')).toContainText(second);

	await ok(p, '/parent/tutors');
	await ok(p, '/parent/settings');
	await expect(p.getByTestId('settings-child')).toHaveCount(2);
	await ok(p, '/parent/notifications');

	// another parent's child is not reachable
	const r = await p.goto('/parent/child/test_tatenda');
	expect(r?.status()).toBe(404);
});
