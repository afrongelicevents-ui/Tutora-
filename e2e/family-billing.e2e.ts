// Tutora Family: Plans → Checkout (live total) → Tutora's details → proof → the owner
// confirms in Money → Payments → Paid → Tutora receipt. And: with the pilot free trial off, a
// Family page is locked with an Upgrade button (parent) or "Ask your parent" (child).
import { expect, test } from '@playwright/test';
import { as, closeDb, press, sql } from './helpers.ts';

const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
	'base64'
);
const pilot = (on: boolean) => sql(`update tutora_settings set pilot_free_trial = $1`, [on]);

test.afterAll(async () => {
	await pilot(true);
	await closeDb();
});

test('plans → checkout → proof → owner confirms → paid → receipt', async ({ browser }) => {
	await pilot(false);
	const p = await as(browser, 'parent3@example.com');

	// Plans: the exact wording, then on to checkout
	await p.goto('/parent/plans');
	await expect(p.locator('body')).toContainText(
		'No Tutora fee for students — you only pay your tutor. Tutora Family is for the system: planning, consistency, progress, reports and support.'
	);
	await p.getByRole('link', { name: 'Choose children and pay' }).click();
	await expect(p).toHaveURL(/\/parent\/checkout$/);

	// three children ticked, 1 month = $28; 3 months with the 5% test discount = $79.80
	await expect(p.locator('.fam-total')).toContainText('$28');
	await p.locator('form.fam-co[data-ready]').waitFor();
	await p.locator('input[name=period][value="3"]').check();
	await expect(p.locator('.fam-total')).toContainText('$79.80');
	await press(p, 'form[action="?/invoice"] button[type=submit]');
	await expect(p).toHaveURL(/\/parent\/checkout\?invoice=\d+/);
	const id = Number(new URL(p.url()).searchParams.get('invoice'));
	await expect(p.getByRole('heading', { name: 'Invoice $79.80' })).toBeVisible();
	await expect(p.getByText('0770 000 000 (TEST)')).toBeVisible();

	// proof of payment
	await p.selectOption('select[name=method]', 'ecocash');
	await p.fill('input[name=reference]', `E2E-FAM-${id}`);
	await p.setInputFiles('input[name=proof]', {
		name: 'proof.png',
		mimeType: 'image/png',
		buffer: PNG
	});
	await press(p, 'form[action="?/proof"] button[type=submit]');
	await expect(p).toHaveURL(/\/parent\/billing\?sent=1/);
	await expect(p.getByText('Proof sent. Tutora will check it soon.')).toBeVisible();
	const [sent] = await sql<{ status: string }>(`select status from tutora_invoice where id = $1`, [
		id
	]);
	expect(sent.status).toBe('proof_sent');

	// the owner sees it under Overview → Needs your attention and confirms it in Money → Payments
	const owner = await as(browser, 'owner@example.com');
	await owner.goto('/owner');
	await owner.locator('.oa-attn a[href*="view=family"]').click();
	await expect(owner).toHaveURL(/\/owner\/payments\?view=family/);
	const inv = owner.locator('.ofi li', { hasText: `E2E-FAM-${id}` });
	await expect(inv.getByRole('link', { name: 'View proof' })).toBeVisible();
	await inv.locator('form[action="?/familyConfirm"] button').click();
	await expect(owner.locator('.notice')).toContainText('payment confirmed');
	// still on the Tutora Family tab
	await expect(owner.locator('.views .oa-chip[aria-current=page]')).toContainText('Tutora Family');
	const [paid] = await sql<{ status: string }>(`select status from tutora_invoice where id = $1`, [
		id
	]);
	expect(paid.status).toBe('paid');

	// Billing: paid, with a Tutora receipt (PDF)
	await p.goto('/parent/billing');
	const card = p.locator('.fam-inv li', { hasText: '$79.80' }).first();
	await expect(card).toContainText('Paid');
	const href = await card.getByRole('link', { name: 'View receipt' }).getAttribute('href');
	const pdf = await p.request.get(href!);
	expect(pdf.status()).toBe(200);
	expect(pdf.headers()['content-type']).toContain('application/pdf');
	expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF');
	// another parent can't download it
	const other = await as(browser, 'banda@example.com');
	expect((await other.request.get(href!)).status()).toBe(404);

	// the home page shows the plan as active; the children are open
	await p.goto('/parent');
	await expect(p.locator('.fam-strip')).toContainText('Active until');
	await p.goto('/parent/progress');
	await expect(p).toHaveURL(/\/parent\/progress/);
});

test('pilot off: a Family page is locked with Upgrade; a child is told to ask', async ({
	browser
}) => {
	const parent = await as(browser, 'banda@example.com');
	const child = await as(browser, 'rudo@example.com');
	// during the pilot everything is open
	await pilot(true);
	await parent.goto('/parent/progress');
	await expect(parent).toHaveURL(/\/parent\/progress/);

	await pilot(false);
	await parent.goto('/parent/progress');
	await expect(parent).toHaveURL(/\/parent\/plans\?locked=progress/);
	await expect(parent.getByText('Progress is part of Tutora Family.')).toBeVisible();
	await parent.getByRole('link', { name: 'Upgrade to Tutora Family' }).first().click();
	await expect(parent).toHaveURL(/\/parent\/checkout/);
	// the home page offers Pay now (an invoice is waiting) or Upgrade
	await parent.goto('/parent');
	await expect(parent.locator('.fam-strip a.ui-btn')).toBeVisible();

	// the child (connected to a parent): locked, "Ask your parent about Tutora Family"
	await child.goto('/student/planner');
	await expect(child).toHaveURL(/\/student\/upgrade\?locked=planner/);
	await expect(child.getByText('Ask your parent about Tutora Family.')).toBeVisible();
	// a form post to a locked page is refused too (server-side, not only the page)
	const r = await child.request.post('/student/planner?/add', {
		form: { title: 'x' },
		maxRedirects: 0
	});
	expect(r.status()).toBe(303);
	expect(r.headers().location).toContain('/student/upgrade');
	await pilot(true);
});
