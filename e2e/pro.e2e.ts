// Tutora Pro: a Free tutor (tendai) sees "Pro" + Upgrade on Pro features (never a broken
// page), upgrades: plan → checkout → Tutora's details → proof → the owner confirms in Money →
// Payments → Tutora Pro → Paid → receipt, and then has the Pro tools. The Pro tutor (chipo)
// downloads the earnings report. The owner gives Pro free to a chosen tutor and removes it.
import { expect, test } from '@playwright/test';
import { as, closeDb, press, sql } from './helpers.ts';

const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
	'base64'
);
const resetTendai = async () => {
	await sql(`delete from pro_invoice where tutor_id = 'test_tendai'`);
	await sql(`delete from pro_subscription where tutor_id = 'test_tendai'`);
	await sql(`delete from plan_gift where user_id = 'test_tendai'`);
};

test.beforeAll(async () => {
	// Free and Pro look different only with the pilot switch off (as the test seed has it)
	await sql(`update tutora_settings set pro_pilot_free_trial = false`);
	await resetTendai();
});
test.afterAll(async () => {
	await resetTendai();
	await closeDb();
});

test('Free tutor: Pro features locked with Upgrade → pays → owner confirms → Pro', async ({
	browser
}) => {
	const t = await as(browser, 'tendai@example.com');

	// locked Pro features: a short "Pro" label and an Upgrade button, never a broken page
	await t.goto('/tutor/insights');
	await expect(t.locator('.pro-lock')).toBeVisible();
	await expect(t.locator('.pro-lock .pro-pill')).toHaveText('Pro');
	await t.goto('/tutor/payments');
	await expect(t.locator('#earnings-report .pro-lock')).toBeVisible();
	const exp = await t.request.get('/tutor/payments/export', { maxRedirects: 0 });
	expect(exp.status()).toBe(303);
	expect(exp.headers()['location']).toContain('/tutor/pro?locked=export');
	await t.locator('#earnings-report .pro-lock a', { hasText: 'Upgrade to Pro' }).click();
	await expect(t).toHaveURL(/\/tutor\/pro\?locked=earnings/);
	await expect(t.locator('.notice').first()).toContainText('part of Tutora Pro');
	await expect(t.locator('body')).toContainText('$5 a month');
	await expect(t.locator('body')).toContainText('No Tutora fee on your lessons');

	// choose 3 months (test discount 5%: $14.25) → checkout
	await t.locator('form[action="?/invoice"][data-ready]').waitFor();
	await t.locator('input[name=period][value="3"]').check();
	await expect(t.locator('body')).toContainText('Total: $14.25');
	await press(t, 'form[action="?/invoice"] button[type=submit]');
	await expect(t).toHaveURL(/\/tutor\/pro\/checkout\?invoice=\d+/);
	const id = Number(new URL(t.url()).searchParams.get('invoice'));
	await expect(t.getByRole('heading', { name: 'Invoice $14.25' })).toBeVisible();
	await expect(t.getByText('0770 000 000 (TEST)')).toBeVisible();
	await t.selectOption('select[name=method]', 'ecocash');
	await t.fill('input[name=reference]', `E2E-PRO-${id}`);
	await t.setInputFiles('input[name=proof]', {
		name: 'proof.png',
		mimeType: 'image/png',
		buffer: PNG
	});
	await press(t, 'form[action="?/proof"] button[type=submit]');
	await expect(t).toHaveURL(/\/tutor\/pro\/billing\?sent=1/);
	await expect(t.locator('.fam-inv li').first()).toContainText('Proof sent');

	// the owner: Overview → Needs your attention → Payments → Tutora Pro → Confirm
	const owner = await as(browser, 'owner@example.com');
	await owner.goto('/owner');
	await expect(owner.locator('#family-stats')).toContainText('Pro tutors');
	await owner.locator('.oa-attn a[href*="view=pro"]').click();
	await expect(owner).toHaveURL(/\/owner\/payments\?view=pro/);
	await expect(owner.locator('.views .oa-chip[aria-current=page]')).toContainText('Tutora Pro');
	const inv = owner.locator('.ofi li', { hasText: `E2E-PRO-${id}` });
	await expect(inv.getByRole('link', { name: 'View proof' })).toBeVisible();
	await inv.locator('form[action="?/proConfirm"] button').click();
	await expect(owner.locator('.notice')).toContainText('P-0000');
	const [paid] = await sql<{ status: string }>(`select status from pro_invoice where id = $1`, [
		id
	]);
	expect(paid.status).toBe('paid');

	// the tutor: Paid, a Tutora receipt (PDF) only for them, and the Pro tools open
	await t.goto('/tutor/pro/billing');
	const card = t.locator('.fam-inv li', { hasText: '$14.25' }).first();
	await expect(card).toContainText('Paid');
	const href = await card.getByRole('link', { name: 'View receipt' }).getAttribute('href');
	const pdf = await t.request.get(href!);
	expect(pdf.status()).toBe(200);
	expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF');
	const other = await as(browser, 'farai@example.com');
	expect((await other.request.get(href!)).status()).toBe(404);
	await t.goto('/tutor/insights');
	await expect(t.locator('.pro-lock')).toHaveCount(0);
	await expect(t.locator('h1')).toContainText('Student insights');
	await t.goto('/tutor/pro');
	await expect(t.locator('body')).toContainText('Your Pro tools');
});

test('Pro tutor: earnings report PDF and spreadsheet, insights, class tools', async ({
	browser
}) => {
	const c = await as(browser, 'chipo@example.com');
	await c.goto('/tutor/payments');
	await expect(c.locator('#earnings-report .pro-lock')).toHaveCount(0);
	const pdf = await c.request.get('/tutor/payments/report');
	expect(pdf.status()).toBe(200);
	expect(pdf.headers()['content-type']).toContain('application/pdf');
	const csv = await c.request.get('/tutor/payments/export');
	expect(csv.status()).toBe(200);
	expect(await csv.text()).toContain('Date,Student,Amount');
	await c.goto('/tutor/insights');
	await expect(c.locator('.ins').first()).toBeVisible();
	// class tools open from a group lesson (or directly for any own lesson)
	const [l] = await sql<{ id: number }>(
		`select id from lesson where tutor_id = 'test_chipo' order by starts_at desc limit 1`
	);
	await c.goto(`/tutor/class/${l.id}`);
	await expect(c.locator('h1')).toContainText('Class tools');
	// another tutor's lesson is not found
	const t = await as(browser, 'tendai@example.com');
	expect((await t.request.get(`/tutor/class/${l.id}`)).status()).toBe(404);
});

test('owner gives Pro free to a chosen tutor, then removes it', async ({ browser }) => {
	await resetTendai();
	const owner = await as(browser, 'owner@example.com');
	await owner.goto('/owner/settings?gq=Tendai#gifts');
	const give = owner.locator('form.gift-give', { hasText: 'tendai@example.com' });
	await give.locator('input[name=note]').fill('Family member');
	await give.locator('button[type=submit]').click();
	await expect(owner.locator('#gifts .notice')).toContainText('for free now');
	const t = await as(browser, 'tendai@example.com');
	await t.goto('/tutor/pro');
	await expect(t.locator('body')).toContainText('Given free by Tutora');
	// remove: "Are you sure?" first
	await owner.goto('/owner/settings#gifts');
	const row = owner.locator('.gift-list li', { hasText: 'tendai@example.com' });
	await row.locator('summary', { hasText: 'Remove' }).click();
	await row.locator('input[name=sure]').check();
	await row.locator('form button[type=submit]').last().click();
	await expect(owner.locator('#gifts .notice')).toContainText('removed');
	await t.goto('/tutor/insights');
	await expect(t.locator('.pro-lock')).toBeVisible();
});
