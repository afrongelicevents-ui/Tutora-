// Tutora Family per child: a parent who paid for 1 of their 3 children gets the Family pages
// for that child only. The other two show the free view with "Add this child to Tutora
// Family", which opens checkout with that child (and the covered one) ticked.
import { expect, test } from '@playwright/test';
import { as, closeDb, sql } from './helpers.ts';

const P = 'test_parent3';
const [K1, K2, K3] = ['test_parent3_kid1', 'test_parent3_kid2', 'test_parent3_kid3'];

test.beforeAll(async () => {
	await sql(`update tutora_settings set pilot_free_trial = false`);
	await sql(
		`update family_subscription set status = 'active', paid_until = now() + interval '20 days'
		 where parent_id = $1`,
		[P]
	);
	await sql(
		`delete from subscription_child where subscription_id = (select id from family_subscription where parent_id = $1)`,
		[P]
	);
	await sql(
		`insert into subscription_child (subscription_id, student_id, active)
		 select id, $2, true from family_subscription where parent_id = $1`,
		[P, K1]
	);
	// no gift for this family (a gift would open every child)
	await sql(`delete from plan_gift where user_id = $1`, [P]);
});
test.afterAll(async () => {
	await closeDb();
});

test('1 of 3 children covered: only that child opens; Add this child → checkout', async ({
	browser
}) => {
	const p = await as(browser, 'parent3@example.com');

	// the covered child's Family pages open
	await p.goto(`/parent/progress?child=${K1}`);
	await expect(p).toHaveURL(new RegExp(`/parent/progress\\?child=${K1}`));

	// an uncovered child: their own (free) page, with the button
	await p.goto(`/parent/progress?child=${K2}`);
	await expect(p).toHaveURL(new RegExp(`/parent/child/${K2}\\?locked=progress`));
	await expect(p.locator('.fam-add')).toContainText('Progress for Tanaka is part of Tutora Family');
	await expect(p.locator('.fam-add a.ui-btn')).toHaveText('Add this child to Tutora Family');

	// the same on the server for files and form posts, not only pages
	const pdf = await p.request.get(`/parent/child/${K3}/reports/1/pdf`, { maxRedirects: 0 });
	expect(pdf.status()).toBe(303);
	expect(pdf.headers().location).toContain(`/parent/child/${K3}?locked=report`);
	const post = await p.request.post('/parent/school-plus?/request', {
		form: { child: K3, tutor: 'x', subject: 'Maths', school: 'S', teacher: 'T' },
		maxRedirects: 0
	});
	expect(post.status()).toBe(303);
	expect(post.headers().location).toContain(`/parent/child/${K3}?locked=school`);

	// home: the uncovered children say so, with the same button
	await p.goto('/parent');
	const add = p.locator('.fam-kid a', { hasText: 'Add this child to Tutora Family' });
	await expect(add).toHaveCount(2);

	// "Add this child" → checkout with Tanaka and the covered Tino ticked: 2 children = $20
	await p.goto(`/parent/child/${K2}`);
	await p.locator('.fam-add a.ui-btn').click();
	await expect(p).toHaveURL(new RegExp(`/parent/checkout\\?child=${K2}`));
	await expect(p.locator(`input[name=child][value=${K1}]`)).toBeChecked();
	await expect(p.locator(`input[name=child][value=${K2}]`)).toBeChecked();
	await expect(p.locator(`input[name=child][value=${K3}]`)).not.toBeChecked();
	await expect(p.locator('.fam-co')).toContainText('Already on Tutora Family');
	await expect(p.locator('.fam-total')).toContainText('$20');
});
