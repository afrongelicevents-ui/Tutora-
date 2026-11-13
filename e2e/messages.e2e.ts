// Flow: student and tutor message each other both ways; each side sees an unread count
// that goes back to zero after reading, and the bell gets a "message" notification.
import { expect, test, type Page } from '@playwright/test';
import { as, closeDb, sql, uniq } from './helpers.ts';

test.afterAll(closeDb);

async function send(page: Page, text: string) {
	await page.fill('#msg-body', text);
	await page.click('form[action="?/send"] button[type=submit]');
	await expect(page.locator('main')).toContainText(text);
}

test('messages both ways with unread counts', async ({ browser }) => {
	const id = uniq();
	const student = await as(browser, 'nyasha@example.com');
	const tutor = await as(browser, 'chipo@example.com');

	// start with both threads read (each side opens it once)
	await student.goto('/student/messages/test_chipo');
	await tutor.goto('/tutor/messages/test_nyasha');

	// 1. the student sends two messages
	await student.goto('/student/messages/test_chipo');
	await send(student, `Hello sir ${id}`);
	await send(student, `Question about fractions ${id}`);

	// 2. the tutor sees 2 unread from Nyasha
	await tutor.goto('/tutor/messages');
	const row = tutor.locator('a.row[href="/tutor/messages/test_nyasha"]');
	await expect(row.locator('.dot')).toContainText(': 2');
	const [bell] = await sql<{ n: number }>(
		`select count(*)::int n from notification where user_id = 'test_chipo' and kind = 'message' and created_at > now() - interval '1 minute'`
	);
	expect(bell.n).toBeGreaterThanOrEqual(2);

	// 3. the tutor reads them: the count is gone, and replies
	await tutor.goto('/tutor/messages/test_nyasha');
	await expect(tutor.locator('main')).toContainText(`Question about fractions ${id}`);
	await tutor.goto('/tutor/messages');
	await expect(row.locator('.dot')).toHaveCount(0);
	await tutor.goto('/tutor/messages/test_nyasha');
	await send(tutor, `Happy to help ${id}`);

	// 4. the student sees 1 unread on the Tutors tab, reads it, the badge goes
	await student.goto('/student/tutors');
	const badge = student.locator('a.badge[href="/student/messages/test_chipo"]');
	await expect(badge).toHaveText('1');
	await student.goto('/student/messages/test_chipo');
	await expect(student.locator('main')).toContainText(`Happy to help ${id}`);
	await student.goto('/student/tutors');
	await expect(badge).toHaveCount(0);
});
