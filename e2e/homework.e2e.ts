// Flow: tutor sets homework → student hands it in → tutor marks it with a score →
// student sees the feedback and the mark in progress → the parent who sees homework is told.
import { expect, test } from '@playwright/test';
import { as, closeDb, pick, press, sql, uniq } from './helpers.ts';

test.afterAll(closeDb);

test('homework set, handed in, marked, feedback, progress, parent told', async ({ browser }) => {
	const id = uniq();
	const title = `E2E homework ${id}`;
	const topic = `Fractions ${id}`;
	const tutor = await as(browser, 'chipo@example.com');
	const student = await as(browser, 'tatenda@example.com');

	// 1. the tutor sets homework for Tatenda
	await tutor.goto('/tutor/homework');
	await pick(tutor, 'input[name=to][value=test_tatenda]');
	await tutor.fill('#hw-title', title);
	await tutor.fill('#hw-subj', 'Mathematics');
	await tutor.fill('#hw-topic', topic);
	await press(tutor, 'form[action="?/send"] button[type=submit]');
	const [hw] = await sql<{ id: number }>(
		`select id from homework where user_id = 'test_tatenda' and title = $1`,
		[title]
	);
	expect(hw).toBeTruthy();

	// 2. the student sees it and hands it in
	await student.goto('/student/homework');
	const card = student.locator('.card.hw', { hasText: title });
	await expect(card).toBeVisible();
	await card.locator('summary').click();
	await card.locator('textarea[name=note]').fill('My answer ' + id);
	await press(student, `.card.hw:has-text("${title}") form[action="?/handIn"] button[type=submit]`);
	await expect(student.locator('.notice')).toBeVisible();

	// 3. the tutor marks it with a score on Marking
	await tutor.goto('/tutor/homework');
	const row = tutor.locator('li', { hasText: title });
	await expect(row).toBeVisible();
	await row.locator('textarea[name=comment]').fill('Well done ' + id);
	await row.locator('input[name=score]').fill('8');
	await row.locator('input[name=maxScore]').fill('10');
	await press(tutor, `li:has-text("${title}") form[action="?/check"] button[type=submit]`);
	await expect(tutor.locator('li', { hasText: title })).toHaveCount(0);

	// 4. the student sees the mark and the feedback, and the topic in progress
	await student.goto('/student/homework');
	const done = student.locator('.card.hw', { hasText: title });
	await expect(done).toContainText('Well done ' + id);
	await expect(done).toContainText('8');
	await student.goto('/student/progress');
	await expect(student.locator('body')).toContainText(topic);

	// 5. the parent who sees homework (Sibanda) was told: set and marked
	const notes = await sql<{ title: string }>(
		`select title from notification where user_id = 'test_sibanda' and created_at > now() - interval '5 minutes' and kind = 'homework'`
	);
	expect(notes.length).toBeGreaterThanOrEqual(2);
	// and the student got the "marked" note in the bell
	const [n] = await sql<{ n: number }>(
		`select count(*)::int n from notification where user_id = 'test_tatenda' and link like '/student/homework%' and created_at > now() - interval '5 minutes'`
	);
	expect(n.n).toBeGreaterThan(0);
});
