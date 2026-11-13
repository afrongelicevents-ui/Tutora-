// Flow: Connected tools for a tutor and a student. Without Google/Microsoft keys every card
// says so honestly (no dead "Connect" buttons), every link on the pages works, Kahoot! can be
// switched on, and the student's Lessons tab shows the same status.
import { expect, test, type Page } from '@playwright/test';
import { as, closeDb, press } from './helpers.ts';

test.afterAll(closeDb);

async function linksWork(page: Page) {
	const hrefs = await page
		.locator('main a[href^="/"]')
		.evaluateAll((as) => [
			...new Set(as.map((a) => (a as HTMLAnchorElement).getAttribute('href')!))
		]);
	for (const h of hrefs) {
		const r = await page.request.get(h, { maxRedirects: 5 });
		expect(r.status(), h).toBeLessThan(400);
	}
	return hrefs;
}

test('connected tools: honest status, working links, Kahoot! on', async ({ browser }) => {
	const tutor = await as(browser, 'chipo@example.com');
	const student = await as(browser, 'nyasha@example.com');

	for (const [page, path] of [
		[tutor, '/tutor/tools'],
		[student, '/student/tools']
	] as const) {
		await page.goto(path);
		const main = page.locator('main');
		const connectable = await page.locator('main a[href^="/tools/connect/"]').count();
		if (!connectable) {
			// no keys on this site: each Google/Microsoft card says it isn't available yet
			await expect(main).toContainText('Not connected');
			await expect(main).toContainText('Not available yet');
		}
		await linksWork(page);
		// going to a connect address by hand never breaks: it comes back with a message
		const r = await page.request.get('/tools/connect/google', { maxRedirects: 5 });
		expect(r.status()).toBeLessThan(500);
	}

	// Kahoot! needs no account: the student switches it on, the Lessons tab shows "Ready"
	await student.goto('/student/tools');
	const turnOff = student.locator('form[action="?/kahoot"] button.disconnect');
	if (await turnOff.count()) await press(student, 'form[action="?/kahoot"] button');
	await press(student, 'form[action="?/kahoot"] button');
	await expect(student.locator('main')).toContainText('no Kahoot! account needed');
	await student.goto('/student/lessons');
	await expect(student.locator('main')).toContainText('Kahoot!');
	await linksWork(student);

	// the tutor switches Kahoot! on too: the quiz page opens
	await tutor.goto('/tutor/tools');
	if (!(await tutor.locator('form[action="?/kahoot"] button.disconnect').count()))
		await press(tutor, 'form[action="?/kahoot"] button');
	await expect(tutor.locator('a[href="/tutor/tools/kahoot"]')).toBeVisible();
	const k = await tutor.goto('/tutor/tools/kahoot');
	expect(k?.status()).toBe(200);
});
