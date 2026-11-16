// Flow: a student sees their own tutor reports (You → My personal report). The tutor's note is
// for the parents only unless the tutor shows it to the student: a parent-only note never
// reaches the student's page, page data or PDF; the parent always sees it.
import { expect, test } from '@playwright/test';
import { as, closeDb, pick, press, uniq } from './helpers.ts';

test.afterAll(closeDb);

test('report notes: parent only by default, visible to the student when the tutor says so', async ({
	browser
}) => {
	const secret = `Talked about bedtime ${uniq()}`;
	const praise = `Brilliant algebra ${uniq()}`;
	const tutor = await as(browser, 'chipo@example.com');
	const student = await as(browser, 'tatenda@example.com');
	const parent = await as(browser, 'sibanda@example.com');

	// 1. the tutor sends a report with a parent-only note (the default)
	await tutor.goto('/tutor/reports');
	await tutor.selectOption('select[name=studentId]', 'test_tatenda');
	const create = tutor.locator('form[action="?/create"]');
	await create.locator('textarea[name=note]').fill(secret);
	await expect(create.locator('input[name=noteVisible][value=parent]')).toBeChecked();
	await press(tutor, 'form[action="?/create"] button[type=submit]');
	await press(tutor, 'article.rep >> nth=0 >> button[formaction="?/send"]');
	await expect(tutor.locator('.notice')).toContainText('family can see it');
	const id = (await tutor.locator('article.rep').first().getAttribute('id'))!.slice(1);

	// 2. the student finds it from the personal report, without the note
	await student.goto('/student/report');
	const list = student.locator('section[aria-labelledby=pr-tutor-reports]');
	await expect(list).toBeVisible();
	await list.locator(`a[href="/student/reports/${id}"]`).click();
	await expect(student).toHaveURL(new RegExp(`/student/reports/${id}$`));
	await expect(student.locator('h1')).toContainText('Report from');
	await expect(student.locator('main')).not.toContainText(secret);
	await expect(student.locator('[data-student-note]')).toHaveCount(0);
	// not in the page data either
	const data = await student.request.get(`/student/reports/${id}/__data.json`);
	expect(await data.text()).not.toContain(secret);
	const listData = await student.request.get('/student/report/__data.json');
	expect(await listData.text()).not.toContain(secret);
	// the student's PDF downloads
	const pdf = await student.request.get(`/student/reports/${id}/pdf`);
	expect(pdf.headers()['content-type']).toContain('application/pdf');

	// 3. the parent sees the note
	await parent.goto('/parent/child/test_tatenda');
	await expect(parent.locator('#reports')).toContainText(secret);

	// 4. the tutor writes a note for the student too and shows it
	await tutor.goto(`/tutor/reports#r${id}`);
	const card = tutor.locator(`article#r${id}`);
	await card.locator('textarea[name=note]').fill(praise);
	await pick(tutor, `article#r${id} input[name=noteVisible][value=student]`);
	await press(tutor, `article#r${id} button[formaction="?/save"]`);
	await student.goto(`/student/reports/${id}`);
	await expect(student.locator('[data-student-note]')).toHaveText(praise);

	// 5. another student cannot open it
	const nyasha = await as(browser, 'nyasha@example.com');
	// (refused: 404, or sent to the Tutora Family page first; never the report)
	const res = await nyasha.request.get(`/student/reports/${id}`, { maxRedirects: 0 });
	expect([303, 403, 404]).toContain(res.status());
	if (res.status() === 303) expect(res.headers()['location']).not.toContain(`/reports/${id}`);
	const followed = await nyasha.request.get(`/student/reports/${id}`);
	expect(await followed.text()).not.toContain(praise);
	const pdfOther = await nyasha.request.get(`/student/reports/${id}/pdf`, { maxRedirects: 0 });
	expect(pdfOther.headers()['content-type'] ?? '').not.toContain('application/pdf');
});
