// The parent's child page stays light: at most 5 upcoming lessons and 5 homework items, each
// with "See all" opening the full list on its own page; another family's child is refused.
import { expect, test } from '@playwright/test';
import { as, closeDb, sql } from './helpers.ts';

const KID = 'test_tatenda';
const TAG = 'E2E child-page hw';

test.beforeAll(async () => {
	await sql(`delete from homework where title like $1`, [`${TAG}%`]);
	// 7 homework items for Tatenda from Chipo, so the page has more than it shows
	for (let i = 1; i <= 7; i++)
		await sql(
			`insert into homework (tutor_id, user_id, title, due_on, created_at)
			 values ('test_chipo', $1, $2, current_date + $3::int, now() + ($3::int || ' seconds')::interval)`,
			[KID, `${TAG} ${i}`, i]
		);
});
test.afterAll(async () => {
	await sql(`delete from homework where title like $1`, [`${TAG}%`]);
	await closeDb();
});

test('child page shows at most 5 lessons and 5 homework; See all opens the full lists', async ({
	browser
}) => {
	const p = await as(browser, 'sibanda@example.com');
	await p.goto(`/parent/child/${KID}`);
	const hwRows = p.locator('section[aria-labelledby=hw-h] .rows-list li');
	await expect(hwRows.first()).toBeVisible();
	expect(await hwRows.count()).toBeLessThanOrEqual(5);
	const lessonRows = p.locator('section#lessons .rows-list:not(.past) li');
	expect(await lessonRows.count()).toBeLessThanOrEqual(5);

	// See all homework: every item, including the ones the child page left out
	await p.getByTestId('child-homework-all').click();
	await expect(p).toHaveURL(new RegExp(`/parent/child/${KID}/homework$`));
	const all = p.getByTestId('all-homework').locator('li');
	await expect(all.filter({ hasText: TAG })).toHaveCount(7);

	// See all lessons
	await p.goto(`/parent/child/${KID}`);
	await p.getByTestId('child-lessons-all').click();
	await expect(p).toHaveURL(new RegExp(`/parent/child/${KID}/lessons$`));
	await expect(p.getByTestId('all-upcoming')).toBeVisible();
	await expect(p.getByTestId('all-past')).toBeVisible();
});

test("another family's child is refused on the full lists", async ({ browser }) => {
	const other = await as(browser, 'parent3@example.com');
	for (const path of [`/parent/child/${KID}/lessons`, `/parent/child/${KID}/homework`]) {
		const r = await other.goto(path);
		expect(r?.status()).toBe(404);
	}
});
