// Flow: a student makes a Family Connection code → a parent enters it and connects →
// the parent sees only what the student shares (one area switched off is hidden).
import { expect, test } from '@playwright/test';
import { as, closeDb, press, sql } from './helpers.ts';

test.afterAll(closeDb);

test('family code connects a parent who sees only shared areas', async ({ browser }) => {
	// setup: Ruth is not yet connected to Nyasha (so the flow can run again)
	await sql(`delete from family_link where student_id = 'test_nyasha' and parent_id = 'test_ruth'`);
	await sql(`delete from rate_limit where key like '%test_nyasha%' or id like '%test_nyasha%'`);
	// the site's own limit on new family codes (action_limit) would stop a second run
	await sql(`delete from action_limit where key like 'familyInvite:%test_nyasha%'`);
	const student = await as(browser, 'nyasha@example.com');
	const parent = await as(browser, 'ruth@example.com');

	// 1. the student makes a code (shown once)
	await student.goto('/student/family');
	await press(student, 'form[action="?/invite"] button');
	const code = (await student.locator('.codebox').textContent())?.trim() ?? '';
	expect(code.length).toBeGreaterThan(4);

	// 2. the parent enters it and connects
	await parent.goto('/code');
	await parent.fill('input[name=code]', code);
	await press(parent, 'form.stack button[type=submit]');
	await expect(parent).toHaveURL(/\/code\/connect/);
	await press(parent, 'form[action="?/connect"] button[type=submit]');
	await expect(parent).toHaveURL(/\/parent\?.*(connected|pending)=/);
	const [link] = await sql<{ status: string }>(
		`select status from family_link where student_id = 'test_nyasha' and parent_id = 'test_ruth'`
	);
	expect(link.status).toBe('active');
	// the student was told
	const [n] = await sql<{ n: number }>(
		`select count(*)::int n from notification where user_id = 'test_nyasha' and kind = 'family' and created_at > now() - interval '1 minute'`
	);
	expect(n.n).toBeGreaterThan(0);

	// 3. everything shared: the parent sees the lessons number
	await parent.goto('/parent?child=test_nyasha');
	const lessons = parent.locator('.stat3 > div').nth(2);
	await expect(lessons).toContainText('lessons booked');

	// 4. the student switches lessons off for Ruth
	await student.goto('/student/family');
	const person = student.locator('.person', { has: student.locator('input[value=test_ruth]') });
	await person.locator('input[name=lessons]').uncheck({ force: true });
	await press(
		student,
		'.person:has(input[value=test_ruth]) form[action="?/share"] button[type=submit]'
	);
	const [l2] = await sql<{ lessons: boolean }>(
		`select share_lessons lessons from family_link where student_id = 'test_nyasha' and parent_id = 'test_ruth'`
	);
	expect(l2.lessons).toBe(false);

	// 5. the parent no longer sees lessons
	await parent.goto('/parent?child=test_nyasha');
	await expect(parent.locator('.stat3 > div').nth(2)).toContainText('not shared');
	await expect(parent.locator('.stat3 > div').nth(2)).not.toContainText('lessons booked');
});
