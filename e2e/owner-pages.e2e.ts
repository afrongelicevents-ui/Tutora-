// Tutora admin, every page pressed like the owner would, at phone and desktop size: the
// navigation (bottom tabs / side sections), search and filters, "Are you sure?" steps, the
// new People / School+ / Safety / Photos pages, receipts and the old addresses.
import { expect, test } from '@playwright/test';
import { as, closeDb, press, sql } from './helpers.ts';

const PAGES: [string, RegExp][] = [
	['/owner', /Overview/],
	['/owner/tutors', /Tutors/],
	['/owner/students', /Students/],
	['/owner/parents', /Parents/],
	['/owner/teachers', /Schoolteachers/],
	['/owner/bookings', /Bookings and lessons/],
	['/owner/subjects', /Subjects/],
	['/owner/payments', /Payments/],
	['/owner/school-plus', /School\+ partnerships/],
	['/owner/safety', /Safety/],
	['/owner/reports', /Reports and help/],
	['/owner/moderation', /Photo and bio checks/],
	['/owner/content', /Homepage texts/],
	['/owner/photos', /Photos/],
	['/owner/limits', /Free limits/],
	['/owner/audit', /Activity log/],
	['/owner/settings', /Settings/],
	['/owner/more', /Everything else/]
];

test.afterAll(async () => {
	await sql(`delete from platform_subject where name = 'E2E Pottery'`);
	await sql(`update "user" set suspended_at = null where id = 'test_nyasha'`);
	await closeDb();
});

test('every admin page opens with its title and no errors', async ({ browser }) => {
	const owner = await as(browser, 'owner@example.com');
	const errors: string[] = [];
	owner.on('pageerror', (e) => errors.push(String(e)));
	for (const [path, title] of PAGES) {
		const r = await owner.goto(path);
		expect(r?.status(), path).toBe(200);
		await expect(owner.locator('.oa-head h1'), path).toHaveText(title);
		// nothing wider than the screen
		const w = await owner.evaluate(() => document.documentElement.scrollWidth);
		expect(w, path).toBeLessThanOrEqual((owner.viewportSize()?.width ?? 0) + 2);
	}
	expect(errors).toEqual([]);
});

test('navigation: bottom tabs on phones, titled side sections on desktop', async ({ browser }) => {
	const owner = await as(browser, 'owner@example.com');
	await owner.goto('/owner');
	const phone = (owner.viewportSize()?.width ?? 0) < 900;
	if (phone) {
		const tabs = owner.locator('nav.tabbar a');
		await expect(tabs).toHaveText(['Overview', 'People', 'Money', 'Safety', 'More']);
		await tabs.filter({ hasText: 'People' }).click();
		await expect(owner).toHaveURL(/\/owner\/tutors$/);
		await expect(owner.locator('nav.tabbar a[aria-current=page]')).toHaveText('People');
		await owner.locator('nav.tabbar a', { hasText: 'More' }).click();
		await owner.locator('.oa-hub a', { hasText: 'Schoolteachers' }).click();
		await expect(owner).toHaveURL(/\/owner\/teachers$/);
		// still under People
		await expect(owner.locator('nav.tabbar a[aria-current=page]')).toHaveText('People');
	} else {
		const side = owner.locator('aside.side');
		for (const g of ['People', 'Learning', 'Money', 'School+', 'Safety', 'Content', 'System'])
			await expect(side.locator('.group', { hasText: g }).first()).toBeVisible();
		await side.locator('a', { hasText: 'Photos' }).click();
		await expect(owner).toHaveURL(/\/owner\/photos$/);
		await expect(side.locator('a[aria-current=page]')).toHaveText('Photos');
	}
});

test('overview: each attention card opens the right list', async ({ browser }) => {
	const owner = await as(browser, 'owner@example.com');
	await owner.goto('/owner');
	const cards = owner.locator('.oa-attn .ui-card');
	const n = await cards.count();
	if (!n) await expect(owner.locator('.oa-empty')).toBeVisible();
	for (let i = 0; i < n; i++) {
		await owner.goto('/owner');
		const href = await cards.nth(i).locator('a').getAttribute('href');
		await cards.nth(i).locator('a').click();
		const want = new URL(href!, owner.url());
		await expect
			.poll(() => new URL(owner.url()).pathname + new URL(owner.url()).search)
			.toBe(want.pathname + want.search);
		await expect(owner.locator('.oa-head h1')).toBeVisible();
	}
});

test('lists: search, filter chips with counts, and paging', async ({ browser }) => {
	const owner = await as(browser, 'owner@example.com');
	await owner.goto('/owner/tutors');
	await owner.fill('input[name=q]', 'chipo');
	await owner.locator('.oa-search button').click();
	await expect(owner).toHaveURL(/q=chipo/);
	await expect(owner.locator('.oa-card')).toHaveCount(1);
	await expect(owner.locator('.oa-card')).toContainText('Chipo');
	// a chip keeps the search
	await owner.locator('.oa-chip', { hasText: 'Suspended' }).click();
	await expect(owner).toHaveURL(/status=suspended/);
	await expect(owner).toHaveURL(/q=chipo/);
	await expect(owner.locator('.oa-empty')).toContainText('chipo');

	// payments: more than 25 → a second page
	await owner.goto('/owner/payments');
	const total = Number(
		await owner.locator('.oa-chip', { hasText: 'All' }).locator('.c').textContent()
	);
	if (total > 25) {
		await expect(owner.locator('.oa-pager')).toContainText(`1–25 of ${total}`);
		await owner.locator('.oa-pager a[rel=next]').click();
		await expect(owner).toHaveURL(/page=2/);
		await expect(owner.locator('.oa-pager')).toContainText(`26–`);
	}
	// "not confirmed after 7 days" has its own chip
	await owner.locator('.oa-chip', { hasText: 'Not confirmed after 7 days' }).click();
	await expect(owner).toHaveURL(/status=stale/);
	// bookings: status + date filters together
	await owner.goto('/owner/bookings?status=accepted&when=upcoming');
	await expect(owner.locator('.oa-chip[aria-current=page]')).toHaveText([/Confirmed/, /Coming up/]);
});

test('a receipt downloads from Payments', async ({ browser }) => {
	const owner = await as(browser, 'owner@example.com');
	await owner.goto('/owner/payments?status=confirmed');
	const link = owner.locator('a[href$="/receipt"]').first();
	const href = await link.getAttribute('href');
	const r = await owner.request.get(href!);
	expect(r.status()).toBe(200);
	expect(r.headers()['content-type']).toContain('application/pdf');
	// only the owner
	const student = await as(browser, 'nyasha@example.com');
	const s = await student.request.get(href!, { maxRedirects: 0 });
	expect(s.status()).not.toBe(200);
});

test('students: suspend asks "Are you sure?" first; restore works', async ({ browser }) => {
	const owner = await as(browser, 'owner@example.com');
	await owner.goto('/owner/students?q=nyasha%40example.com');
	const c = owner.locator('.oa-card[data-person=test_nyasha]');
	await c.locator('summary', { hasText: 'Suspend' }).click();
	await expect(c.locator('.oa-sure .q')).toHaveText('Are you sure?');
	// without the tick: refused
	await press(owner, '.oa-card[data-person=test_nyasha] form[action^="?/suspend"] button');
	await expect(owner.locator('.alert')).toContainText('tick');
	let [u] = await sql<{ s: Date | null }>(
		`select suspended_at s from "user" where id = 'test_nyasha'`
	);
	expect(u.s).toBeNull();
	const c2 = owner.locator('.oa-card[data-person=test_nyasha]');
	if (!(await c2.locator('input[name=sure]').isVisible()))
		await c2.locator('summary', { hasText: 'Suspend' }).click();
	await c2.locator('input[name=sure]').check();
	await press(owner, '.oa-card[data-person=test_nyasha] form[action^="?/suspend"] button');
	await expect(owner.locator('.notice')).toBeVisible();
	await expect(owner).toHaveURL(/q=nyasha/); // the search stays
	[u] = await sql(`select suspended_at s from "user" where id = 'test_nyasha'`);
	expect(u.s).not.toBeNull();
	// it is listed under Safety too
	await owner.goto('/owner/safety');
	await expect(owner.locator('#blocked')).toContainText('Nyasha');
	await owner.goto('/owner/students?state=suspended');
	await press(owner, '.oa-card[data-person=test_nyasha] form[action^="?/suspend"] button');
	[u] = await sql(`select suspended_at s from "user" where id = 'test_nyasha'`);
	expect(u.s).toBeNull();
});

test('subjects: add, and removing needs the tick', async ({ browser }) => {
	const owner = await as(browser, 'owner@example.com');
	await owner.goto('/owner/subjects');
	await owner.fill('input[name=name]', 'E2E Pottery');
	await press(owner, 'form[action="?/addSubject"] button');
	await expect(owner.locator('.notice')).toContainText('added');
	const card = '.oa-card[data-subject="E2E Pottery"]';
	await owner.locator(`${card} summary`).click();
	await press(owner, `${card} form button`);
	await expect(owner.locator('.alert')).toBeVisible();
	if (!(await owner.locator(`${card} input[name=sure]`).isVisible()))
		await owner.locator(`${card} summary`).click();
	await owner.locator(`${card} input[name=sure]`).check();
	await press(owner, `${card} form button`);
	await expect(owner.locator('.notice')).toContainText('removed');
	await expect(owner.locator(card)).toHaveCount(0);
});

test('photos: replace needs "I have the right", shows on the site, and goes back', async ({
	browser
}) => {
	const owner = await as(browser, 'owner@example.com');
	await owner.goto('/owner/photos');
	const slot = '#slot-join';
	await owner.locator(`${slot} summary`, { hasText: 'Replace photo' }).click();
	await owner.setInputFiles(`${slot} input[type=file]`, 'static/photos/family-study-narrow.webp');
	await owner.fill(`${slot} input[name=credit]`, 'E2E credit');
	// without the tick: refused
	await press(owner, `${slot} form[action="?/replace"] button`);
	await expect(owner.locator('.alert')).toContainText('right to use');
	await owner.setInputFiles(`${slot} input[type=file]`, 'static/photos/family-study-narrow.webp');
	await owner.locator(`${slot} input[name=rights]`).check();
	await press(owner, `${slot} form[action="?/replace"] button`);
	await expect(owner.locator('.notice')).toContainText('new photo');
	await expect(owner.locator(slot)).toContainText('E2E credit');
	// the sign-up page shows it
	const visitor = await browser.newPage();
	await visitor.goto('/join');
	const src = await visitor.locator('img[src^="/photo/join"]').first().getAttribute('src');
	expect(src).toMatch(/^\/photo\/join\?v=\d+$/);
	expect((await visitor.request.get(src!)).status()).toBe(200);
	// back to the standard photo (two steps)
	await owner.locator(`${slot} summary`, { hasText: 'Use the standard photo' }).click();
	await owner.locator(`${slot} .oa-sure input[name=sure]`).check();
	await press(owner, `${slot} form[action="?/remove"] button`);
	await expect(owner.locator('.notice')).toContainText('standard photo');
	await visitor.goto('/join');
	await expect(visitor.locator('img[src="/photos/parent-helping.webp"]').first()).toBeVisible();
	await visitor.close();
});

test('old addresses still work', async ({ browser }) => {
	const owner = await as(browser, 'owner@example.com');
	await owner.goto('/owner/account');
	await expect(owner).toHaveURL(/\/owner\/settings$/);
	await expect(owner.locator('form[action="?/changePassword"]')).toBeVisible();
	const r = await owner.request.get('/hero-photo', { maxRedirects: 0 });
	expect(r.status()).toBe(302);
});

test('Tutora Family: figures on Overview, invoices in Money, payment details in Settings', async ({
	browser
}) => {
	const owner = await as(browser, 'owner@example.com');
	await owner.goto('/owner');
	await expect(owner.locator('#family-stats h2')).toHaveText('Tutora Family and Pro');
	await owner.locator('#family-stats a', { hasText: 'Tutora Family invoices' }).click();
	await expect(owner).toHaveURL(/\/owner\/payments\?view=family/);
	await expect(owner.locator('#ofi-h')).toHaveText('Tutora Family invoices');
	// back to the tutor payments tab
	await owner.locator('.views .oa-chip', { hasText: 'Tutor payments' }).click();
	await expect(owner.locator('.oa-table, .oa-empty').first()).toBeVisible();
	// payment details: saved, and the pilot switch kept as it was
	await owner.locator('a', { hasText: 'Tutora payment details' }).first().click();
	await expect(owner).toHaveURL(/\/owner\/settings#family-pay/);
	const [before] = await sql<{ p: boolean }>(`select pilot_free_trial p from tutora_settings`);
	await press(owner, '#family-pay form button[type=submit]');
	await expect(owner.locator('#family-pay .notice')).toBeVisible();
	const [after] = await sql<{ p: boolean }>(`select pilot_free_trial p from tutora_settings`);
	expect(after.p).toBe(before.p);
});
