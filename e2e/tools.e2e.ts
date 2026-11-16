// Flow: Connected tools are shortcuts only. Each card opens the app (https, a new tab);
// nothing says "Connected", there is no connect/sync address any more, and Kahoot! quiz
// links can still be switched on.
import { expect, test } from '@playwright/test';
import { as, closeDb, press } from './helpers.ts';

test.afterAll(closeDb);

test('connected tools: shortcuts only, no sync, Kahoot! on', async ({ browser }) => {
	const tutor = await as(browser, 'chipo@example.com');
	const student = await as(browser, 'nyasha@example.com');

	for (const [page, path] of [
		[tutor, '/tutor/tools'],
		[student, '/student/tools']
	] as const) {
		await page.goto(path);
		const main = page.locator('main');
		await expect(main).toContainText(/doesn't (sign in to your accounts|connect to any account)/);
		await expect(main).not.toContainText(/Not connected|Connect Google|Disconnect/);
		for (const name of ['Microsoft Teams', 'Google Meet', 'Zoom', 'Google Drive', 'Kahoot!']) {
			const a = main.getByRole('link', { name: `Open ${name}` });
			await expect(a).toBeVisible();
			expect(await a.getAttribute('href')).toMatch(/^https:\/\//);
			expect(await a.getAttribute('target')).toBe('_blank');
		}
		expect(await page.locator('a[href^="/tools/connect"]').count()).toBe(0);
		const r = await page.request.get('/tools/connect/google', { maxRedirects: 0 });
		expect(r.status()).toBe(404);
	}

	// Kahoot! quiz links: the student switches them on
	await student.goto('/student/tools');
	if (await student.locator('form[action="?/kahoot"] button.disconnect').count())
		await press(student, 'form[action="?/kahoot"] button');
	await press(student, 'form[action="?/kahoot"] button');
	await expect(student.locator('main')).toContainText('no Kahoot! account needed');
	// the Lessons tab shows the shortcut tiles
	await student.goto('/student/lessons');
	await expect(student.locator('.tt-tools')).toContainText('Kahoot!');
	expect(await student.locator('.tt-tools a[href^="https://"]').count()).toBe(4);

	// the tutor switches Kahoot! on too: the scores page opens
	await tutor.goto('/tutor/tools');
	if (!(await tutor.locator('form[action="?/kahoot"] button.disconnect').count()))
		await press(tutor, 'form[action="?/kahoot"] button');
	await expect(tutor.locator('a[href="/tutor/tools/kahoot"]')).toBeVisible();
	const k = await tutor.goto('/tutor/tools/kahoot');
	expect(k?.status()).toBe(200);
});
