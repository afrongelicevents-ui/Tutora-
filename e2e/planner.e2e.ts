// Flow: a student plans a task and ticks it → the personal report shows it → sharing on:
// the parent sees the summary (tasks done); sharing off: the parent sees nothing.
import { expect, test } from '@playwright/test';
import { as, closeDb, press, sql, uniq } from './helpers.ts';

test.afterAll(closeDb);

test('planner ticks, personal report, parent sees it only when shared', async ({ browser }) => {
	const title = `Revise ${uniq()}`;
	const student = await as(browser, 'tatenda@example.com');
	const parent = await as(browser, 'sibanda@example.com');

	// 1. the student adds a task for today and ticks it
	await student.goto('/student/planner');
	await student.fill('#pl-title', title);
	await press(student, 'form[action="?/addTask"] button[type=submit]');
	const item = student.locator('ul.items li', { hasText: title });
	await expect(item).toBeVisible();
	await press(student, `ul.items li:has-text("${title}") form[action="?/tick"] button`);
	await expect(student.locator('ul.items li.done', { hasText: title })).toBeVisible();

	// 2. the personal report shows the ticked task
	await student.goto('/student/report');
	await expect(student.locator('main')).toContainText(title);

	// 3. not shared: the parent sees nothing of it
	await press(student, 'form[action="?/shareReport"] button[value=no]');
	await parent.goto('/parent/personal?child=test_tatenda');
	await expect(parent.locator('main')).toContainText("hasn't shared their personal report");
	await expect(parent.locator('.stats')).toHaveCount(0);

	// 4. shared: the parent sees the summary, with today's ticked task counted
	await press(student, 'form[action="?/shareReport"] button[value=yes]');
	const [n] = await sql<{ n: number }>(
		`select count(*)::int n from notification where user_id = 'test_sibanda' and created_at > now() - interval '1 minute'`
	);
	expect(n.n).toBeGreaterThan(0);
	await parent.goto('/parent/personal?child=test_tatenda');
	const stats = parent.locator('.stats');
	await expect(stats).toBeVisible();
	const tasks = Number(await stats.locator('div').nth(1).locator('strong').textContent());
	expect(tasks).toBeGreaterThanOrEqual(1);
	await expect(parent.locator('main')).not.toContainText(title); // titles stay private
});
