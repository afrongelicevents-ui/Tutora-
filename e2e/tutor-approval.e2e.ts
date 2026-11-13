// Flow: a tutor sends their page for approval → the owner approves it → the tutor is told
// and appears in Find a tutor for students (and not before).
import { expect, test } from '@playwright/test';
import { as, closeDb, press, sql } from './helpers.ts';

test.beforeAll(async () => {
	// setup only: Rumbi's page is waiting for approval and has a subject to teach
	await sql(
		`update tutor_profile set status = 'pending', approved_at = null where tutor_id = 'test_rumbi'`
	);
	await sql(
		`insert into subject (tutor_id, name, levels, price_cents)
		 select 'test_rumbi', 'Chemistry', 'O Level', 1200
		 where not exists (select 1 from subject where tutor_id = 'test_rumbi')`
	);
});
test.afterAll(async () => {
	// leave the seed as it was: Rumbi waiting for approval
	await sql(
		`update tutor_profile set status = 'pending', approved_at = null where tutor_id = 'test_rumbi'`
	);
	await closeDb();
});

test('owner approves a tutor, who then appears in Find', async ({ browser }) => {
	const owner = await as(browser, 'owner@example.com');
	const student = await as(browser, 'nyasha@example.com');

	// 1. not approved yet: students can't find Rumbi
	await student.goto('/student/find?n=100');
	await expect(student.locator('main')).not.toContainText('Rumbi Chikwanha');

	// 2. the owner approves the waiting page
	await owner.goto('/owner');
	await expect(owner).toHaveURL(/\/owner/); // the owner area opens (two-step on the test site)
	await press(
		owner,
		'form[action="?/status"]:has(input[name=id][value=test_rumbi]):has(input[name=status][value=active]) button'
	);
	await expect(owner.locator('.notice')).toBeVisible();
	const [p] = await sql<{ status: string }>(
		`select status from tutor_profile where tutor_id = 'test_rumbi'`
	);
	expect(p.status).toBe('active');
	const [n] = await sql<{ n: number }>(
		`select count(*)::int n from notification where user_id = 'test_rumbi' and created_at > now() - interval '1 minute'`
	);
	expect(n.n).toBeGreaterThan(0);

	// 3. students now find Rumbi and can open the page
	await student.goto('/student/find?n=100');
	await expect(student.locator('main')).toContainText('Rumbi Chikwanha');
	const r = await student.goto('/t/rumbi-chikwanha');
	expect(r?.status()).toBe(200);
});
