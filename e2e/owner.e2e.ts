// Owner admin, pressed like a person would: approval refused for a page students could not
// find; suspend (two steps) and restore with the right notices; hide / show a review both
// ways; homepage texts. The other side (tutor, student, the public page) is checked too.
import { expect, test, type Page } from '@playwright/test';
import { as, closeDb, press, sql } from './helpers.ts';

const card = (page: Page, name: string) => page.locator('.card', { hasText: name }).first();

test.beforeAll(async () => {
	// setup only: Rumbi waits for approval, with no subject students could book
	await sql(
		`update tutor_profile set status = 'pending', approved_at = null where tutor_id = 'test_rumbi'`
	);
	await sql(`update subject set active = false where tutor_id = 'test_rumbi'`);
	// Tendai is an active tutor
	await sql(`update tutor_profile set status = 'active' where tutor_id = 'test_tendai'`);
});
test.afterAll(async () => {
	await sql(`update subject set active = true where tutor_id = 'test_rumbi'`);
	await sql(
		`update tutor_profile set status = 'pending', approved_at = null where tutor_id = 'test_rumbi'`
	);
	await sql(`update tutor_profile set status = 'active' where tutor_id = 'test_tendai'`);
	await sql(`delete from site_content where key = 'hero_title'`);
	await closeDb();
});

test('approval is refused while the page has nothing to book', async ({ browser }) => {
	const owner = await as(browser, 'owner@example.com');
	await owner.goto('/owner');
	const c = card(owner, 'Rumbi');
	// warned before approving, and the button is off
	await expect(c).toContainText('Page not filled in yet');
	const approve = c.locator('form[action="?/status"] button');
	await expect(approve).toBeDisabled();
	// even if the form is sent anyway, the server refuses with a clear reason
	await approve.evaluate((b) => ((b as HTMLButtonElement).disabled = false));
	await press(owner, '.card:has-text("Rumbi") form[action="?/status"] button');
	await expect(owner.locator('.alert')).toContainText('no subjects');
	const [p] = await sql<{ status: string }>(
		`select status from tutor_profile where tutor_id = 'test_rumbi'`
	);
	expect(p.status).toBe('pending');
});

test('suspend takes two steps; restoring sends "active again", not a new welcome', async ({
	browser
}) => {
	const owner = await as(browser, 'owner@example.com');
	await owner.goto('/owner');
	const c = card(owner, 'Tendai');
	// step 1 only: without "I'm sure" nothing happens
	await c.locator('summary', { hasText: 'Suspend' }).click();
	await press(
		owner,
		'.card:has-text("Tendai") form[action="?/status"]:has(input[value=suspended]) button'
	);
	await expect(owner.locator('.alert')).toContainText('tick');
	let [p] = await sql<{ status: string }>(
		`select status from tutor_profile where tutor_id = 'test_tendai'`
	);
	expect(p.status).toBe('active');

	// step 2: ticked → suspended, the tutor is told, the page is gone
	const c2 = card(owner, 'Tendai');
	if (!(await c2.locator('input[name=sure]').isVisible()))
		await c2.locator('summary', { hasText: 'Suspend' }).click();
	await c2.locator('input[name=sure]').check();
	await press(
		owner,
		'.card:has-text("Tendai") form[action="?/status"]:has(input[value=suspended]) button'
	);
	await expect(owner.locator('.notice')).toBeVisible();
	await expect(owner).not.toHaveURL(/\?\//); // no "?/status" left in the address
	[p] = await sql(`select status from tutor_profile where tutor_id = 'test_tendai'`);
	expect(p.status).toBe('suspended');
	// a visitor (not logged in) no longer finds the page
	const visitor = await browser.newPage();
	const pub = await visitor.goto('/t/tendai-ncube');
	expect(pub?.status()).toBe(404);
	await visitor.close();

	// restore: "active again"
	await press(
		owner,
		'.card:has-text("Tendai") form[action="?/status"]:has(input[value=active]) button'
	);
	[p] = await sql(`select status from tutor_profile where tutor_id = 'test_tendai'`);
	expect(p.status).toBe('active');
	const [n] = await sql<{ title: string }>(
		`select title from notification where user_id = 'test_tendai' order by created_at desc, id desc limit 1`
	);
	expect(n.title).toBe('Your tutor page is active again');
	const [log] = await sql<{ action: string }>(
		`select action from audit_log order by created_at desc, id desc limit 1`
	);
	expect(log.action).toBe('tutor_restored');
});

test('a review can be hidden and shown again, and stays on the list', async ({ browser }) => {
	const [r] = await sql<{ id: number; text: string; slug: string }>(
		`select r.id, r.text, t.slug from review r join tutor_profile t on t.tutor_id = r.tutor_id
		 where t.status = 'active' and not r.hidden order by r.id limit 1`
	);
	// setup only: a student reported it
	await sql(`update review set reported_at = now(), report_reason = 'e2e check' where id = $1`, [
		r.id
	]);
	const owner = await as(browser, 'owner@example.com');
	const visitor = await browser.newPage();
	await owner.goto('/owner/reports');
	const row = () => owner.locator('.card', { hasText: 'e2e check' }).first();
	await expect(row()).toContainText('Visible');

	await press(owner, `.card:has-text("e2e check") form[action="?/hide"] button`);
	await expect(owner.locator('.notice')).toContainText('hidden');
	await expect(row()).toContainText('Hidden');
	await visitor.goto(`/t/${r.slug}/reviews`);
	await expect(visitor.locator('main')).not.toContainText(r.text.slice(0, 30));

	// shown again: still on the list (so it can be hidden again), report kept
	await press(owner, `.card:has-text("e2e check") form[action="?/hide"] button`);
	await expect(owner.locator('.notice')).toContainText('visible again');
	await expect(row()).toContainText('Visible');
	await visitor.goto(`/t/${r.slug}/reviews`);
	await expect(visitor.locator('main')).toContainText(r.text.slice(0, 30));

	await sql(`update review set reported_at = null, report_reason = null where id = $1`, [r.id]);
	await visitor.close();
});

test('homepage texts change the homepage and go back to the standard wording', async ({
	browser
}) => {
	const owner = await as(browser, 'owner@example.com');
	const visitor = await browser.newPage();
	await owner.goto('/owner/content');
	await owner.fill('input[name=heroTitle]', 'E2E homepage title');
	await press(owner, 'form[action="?/texts"] button');
	await expect(owner.locator('.notice')).toBeVisible();
	await visitor.goto('/');
	await expect(visitor.locator('h1')).toHaveText('E2E homepage title');

	await owner.fill('input[name=heroTitle]', '');
	await press(owner, 'form[action="?/texts"] button');
	await visitor.goto('/');
	const placeholder = await owner.locator('input[name=heroTitle]').getAttribute('placeholder');
	await expect(visitor.locator('h1')).toHaveText(placeholder ?? '');
	await visitor.close();
});
