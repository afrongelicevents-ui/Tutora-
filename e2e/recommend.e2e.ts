// Tutora recommended tutors (Tutora Family): a Family parent (sibanda) sees 3–5 tutors for
// Tatenda that match her subjects and level, the owner's pinned tutor first, the hidden one
// and her own tutor never; a parent on the free level sees a locked preview without names;
// the owner hides a tutor (gone) and pins one (first), in People → Tutors.
import { expect, test } from '@playwright/test';
import { as, closeDb, press, sql } from './helpers.ts';

const resetModes = async () => {
	await sql(`delete from recommend_pref where tutor_id = 'test_rec_1'`);
	await sql(
		`insert into recommend_pref (tutor_id, mode) values ('test_rec_2', 'pinned'), ('test_rec_5', 'hidden')
		 on conflict (tutor_id) do update set mode = excluded.mode`
	);
};

test.beforeAll(async () => {
	// Family and free look different only with the pilot switch off (as the test seed has it)
	await sql(`update tutora_settings set pilot_free_trial = false`);
	await resetModes();
});
test.afterAll(async () => {
	await resetModes();
	await closeDb();
});

const recFor = (page: import('@playwright/test').Page) =>
	page.locator('[data-testid=recommended][data-locked=no] [data-rec-tutor]');

test('Family parent: 3–5 matching tutors, pinned first, never hidden or their own', async ({
	browser
}) => {
	const p = await as(browser, 'sibanda@example.com');
	await p.goto('/parent/tutors');
	const cards = recFor(p);
	const n = await cards.count();
	expect(n).toBeGreaterThanOrEqual(3);
	expect(n).toBeLessThanOrEqual(5);
	await expect(cards.first()).toHaveAttribute('data-rec-tutor', 'nyasha-gumbo');
	const slugs = await cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-rec-tutor')));
	expect(slugs).not.toContain('blessing-moyo'); // hidden by the owner
	expect(slugs).not.toContain('chipo-moyo'); // already Tatenda's tutor
	await expect(p.locator('[data-testid=recommended]').first()).toContainText(
		"Tutors can't pay to be shown here"
	);
	// the child page shows them too, with Book a lesson
	await p.goto('/parent/child/test_tatenda');
	await expect(recFor(p).first()).toBeVisible();
	await expect(recFor(p).first().getByRole('link', { name: 'Book a lesson' })).toBeVisible();
});

test('free level: a locked preview with no tutor names; Add this child opens checkout', async ({
	browser
}) => {
	const p = await as(browser, 'parent3@example.com');
	await p.goto('/parent/tutors');
	const locked = p.locator('[data-testid=recommended][data-locked=yes]').first();
	await expect(locked).toBeVisible();
	const html = await locked.innerHTML();
	for (const name of ['Nyasha Gumbo', 'Kudakwashe', 'Tafadzwa', 'Ropafadzo'])
		expect(html).not.toContain(name);
	// the button opens checkout with that child already ticked, like "Add this child"
	const add = locked.getByRole('link', { name: 'Add this child to Tutora Family' });
	const href = (await add.getAttribute('href')) ?? '';
	const child = new URL(href, 'http://x').searchParams.get('child');
	expect(href).toMatch(/^\/parent\/checkout\?child=/);
	await add.click();
	await expect(p).toHaveURL(/\/parent\/checkout\?child=/);
	await expect(p.locator(`input[name=child][value="${child}"]`)).toBeChecked();
});

test('owner hides a tutor (gone for families), then pins one (shown first)', async ({
	browser
}) => {
	const owner = await as(browser, 'owner@example.com');
	const card = '.oa-card[data-tutor=test_rec_1]';
	await owner.goto('/owner/tutors?q=Kudakwashe');
	await press(owner, `${card} button[value=hidden]`);
	await expect(owner.locator(`${card} form[data-rec=hidden]`)).toBeVisible();

	const p = await as(browser, 'sibanda@example.com');
	await p.goto('/parent/tutors');
	await expect(recFor(p).first()).toBeVisible();
	expect(
		await recFor(p).evaluateAll((els) => els.map((e) => e.getAttribute('data-rec-tutor')))
	).not.toContain('kudakwashe-marufu');

	await owner.goto('/owner/tutors?q=Nyasha+Gumbo');
	await press(owner, '.oa-card[data-tutor=test_rec_2] button[value=normal]');
	await owner.goto('/owner/tutors?q=Kudakwashe');
	await press(owner, `${card} button[value=pinned]`);
	await expect(owner.locator(`${card} form[data-rec=pinned]`)).toBeVisible();

	await p.goto('/parent/tutors');
	await expect(recFor(p).first()).toHaveAttribute('data-rec-tutor', 'kudakwashe-marufu');

	// back as the test data has it (through the owner's buttons, so the site's memory follows)
	await owner.goto('/owner/tutors?q=Kudakwashe');
	await press(owner, `${card} button[value=normal]`);
	await owner.goto('/owner/tutors?q=Nyasha+Gumbo');
	await press(owner, '.oa-card[data-tutor=test_rec_2] button[value=pinned]');
	await expect(
		owner.locator('.oa-card[data-tutor=test_rec_2] form[data-rec=pinned]')
	).toBeVisible();

	// logged for the owner
	const log = await sql<{ action: string }>(
		`select action from audit_log where target = 'test_rec_1' order by id`
	);
	expect(log.map((l) => l.action)).toEqual(
		expect.arrayContaining(['recommend_hidden', 'recommend_pinned'])
	);
});
