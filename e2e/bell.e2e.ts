// Flow: something happens (the tutor sets homework) → the student's bell shows it →
// opening Notifications shows the item and the bell is clear straight away.
import { expect, test } from '@playwright/test';
import { as, bellCount, closeDb, pick, press, sql, uniq } from './helpers.ts';

test.afterAll(closeDb);

test('an event rings the bell; opening notifications clears it', async ({ browser }) => {
	const title = `Bell homework ${uniq()}`;
	// setup: the student has read everything so far
	await sql(
		`update notification set read_at = now() where user_id = 'test_nyasha' and read_at is null`
	);
	const student = await as(browser, 'nyasha@example.com');
	const tutor = await as(browser, 'chipo@example.com');

	await student.goto('/student');
	expect(await bellCount(student)).toBe(0);

	// 1. the tutor sets homework for Nyasha
	await tutor.goto('/tutor/homework');
	await pick(tutor, 'input[name=to][value=test_nyasha]');
	await tutor.fill('#hw-title', title);
	await press(tutor, 'form[action="?/send"] button[type=submit]');

	// 2. the student's bell shows one new
	await student.goto('/student');
	expect(await bellCount(student)).toBe(1);

	// 3. the notifications page lists it and the bell is clear on that same page
	await student.goto('/notifications');
	await expect(student.locator('main')).toContainText(title);
	expect(await bellCount(student)).toBe(0);
	await student.goto('/student');
	expect(await bellCount(student)).toBe(0);
	// following the notification's link opens the homework
	const [n] = await sql<{ link: string }>(
		`select link from notification where user_id = 'test_nyasha' order by created_at desc limit 1`
	);
	const r = await student.goto(n.link);
	expect(r?.status()).toBe(200);
});
