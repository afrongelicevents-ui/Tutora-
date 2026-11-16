// Flow: simpler lessons. Tutora's own video room is hidden (owner switch, off); homework with a
// due time is handed in late as a photo, marked late, and the parent sees it at once; a tutor
// report with a note reaches the parent as a PDF; the "How Tutora works" pages open.
import { expect, test } from '@playwright/test';
import { as, closeDb, pick, press, sql, uniq } from './helpers.ts';

test.afterAll(closeDb);

const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
	'base64'
);

test('the old Tutora video room is off by default', async ({ browser }) => {
	await sql(`delete from site_content where key = 'feature:video_room'`);
	const owner = await as(browser, 'owner@example.com');
	await owner.goto('/owner/settings');
	await expect(owner.locator('#room-h')).toBeVisible();
	await expect(owner.locator('main')).toContainText('It is OFF');
	const student = await as(browser, 'nyasha@example.com');
	for (const p of ['/student', '/student/lessons']) {
		await student.goto(p);
		expect(await student.locator('a[href^="/room/"]').count(), p).toBe(0);
	}
	const tutor = await as(browser, 'chipo@example.com');
	for (const p of ['/tutor', '/tutor/calendar']) {
		await tutor.goto(p);
		expect(await tutor.locator('a[href^="/room/"]').count(), p).toBe(0);
	}
});

test('homework with a due time: handed in late as a photo, marked late, parent sees it', async ({
	browser
}) => {
	const id = uniq();
	const title = `Late work ${id}`;
	const tutor = await as(browser, 'chipo@example.com');
	const student = await as(browser, 'tatenda@example.com');
	const parent = await as(browser, 'sibanda@example.com');

	// 1. the tutor sets it with a date and a time
	await tutor.goto('/tutor/homework');
	await pick(tutor, 'input[name=to][value=test_tatenda]');
	await tutor.fill('#hw-title', title);
	await tutor.fill('#hw-due', '2030-01-10');
	await tutor.fill('#hw-due-time', '17:30');
	await press(tutor, 'form[action="?/send"] button[type=submit]');
	const [hw] = await sql<{ id: number; due_time: string }>(
		`select id, due_time from homework where user_id = 'test_tatenda' and title = $1`,
		[title]
	);
	expect(hw.due_time).toBe('17:30');
	// the parent sees it waiting straight away
	await parent.goto('/parent/child/test_tatenda');
	await expect(parent.locator('section', { has: parent.locator('#hw-h') })).toContainText(title);

	// 2. time passes: the due time was yesterday
	await sql(
		`update homework set due_on = (now() at time zone 'Africa/Harare')::date - 1 where id = $1`,
		[hw.id]
	);

	// 3. the child hands in a photo, after the due time
	await student.goto('/student/homework');
	const card = student.locator('.card.hw', { hasText: title });
	await card.locator('summary').click();
	await card.locator('input[name=file]').setInputFiles({
		name: 'work.png',
		mimeType: 'image/png',
		buffer: PNG
	});
	await press(student, `.card.hw:has-text("${title}") form[action="?/handIn"] button[type=submit]`);
	await expect(student.locator('.notice')).toContainText('after the due time');

	// 4. the parent is told at once and sees "Handed in late"
	const [told] = await sql<{ n: number }>(
		`select count(*)::int n from notification where user_id = 'test_sibanda' and title like '%handed in homework late%' and created_at > now() - interval '5 minutes'`
	);
	expect(told.n).toBeGreaterThan(0);
	await parent.goto('/parent/child/test_tatenda');
	const li = parent.locator('li', { hasText: title });
	await expect(li).toContainText('Handed in late');

	// 5. the tutor sees it is late ("Late" is already chosen) and marks it
	await tutor.goto('/tutor/homework');
	const row = tutor.locator('li', { hasText: title });
	await expect(row).toContainText('Handed in late');
	await expect(row.locator('input[name=mark][value=late]')).toBeChecked();
	await press(tutor, `li:has-text("${title}") form[action="?/check"] button[type=submit]`);
	const [after] = await sql<{ mark: string }>(`select mark from homework where id = $1`, [hw.id]);
	expect(after.mark).toBe('late');

	// 6. the parent sees the tutor's mark
	await parent.goto('/parent/child/test_tatenda');
	await expect(parent.locator('li', { hasText: title })).toContainText('Late');
});

test('a tutor report with a note reaches the parent with a PDF', async ({ browser }) => {
	const note = `Steady progress ${uniq()}`;
	const tutor = await as(browser, 'chipo@example.com');
	const parent = await as(browser, 'sibanda@example.com');

	await tutor.goto('/tutor/reports');
	await tutor.selectOption('select[name=studentId]', 'test_tatenda');
	await tutor.locator('form[action="?/create"] textarea[name=note]').fill(note);
	await press(tutor, 'form[action="?/create"] button[type=submit]');
	await expect(tutor.locator('.notice')).toBeVisible();
	const rep = tutor.locator('article.rep', { hasText: 'Tatenda' }).first();
	await expect(rep).toContainText('Draft');
	// the draft PDF works for the tutor
	const draftPdf = await tutor.request.get(
		(await rep.locator('a', { hasText: 'PDF' }).getAttribute('href'))!
	);
	expect(draftPdf.headers()['content-type']).toContain('application/pdf');
	await press(tutor, 'article.rep >> nth=0 >> button[formaction="?/send"]');
	await expect(tutor.locator('.notice')).toContainText('family can see it');

	await parent.goto('/parent/child/test_tatenda');
	const sec = parent.locator('#reports');
	await expect(sec).toContainText(note);
	const href = await sec.locator('a', { hasText: 'PDF' }).first().getAttribute('href');
	const pdf = await parent.request.get(href!);
	expect(pdf.status()).toBe(200);
	expect(pdf.headers()['content-type']).toContain('application/pdf');
	expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF');
	// another family cannot open it
	const grace = await as(browser, 'grace@example.com');
	const other = await grace.request.get(href!, { maxRedirects: 0 });
	expect(other.status()).toBeGreaterThanOrEqual(400);
});

test('"How Tutora works" opens for each role', async ({ browser }) => {
	for (const [login, path] of [
		['nyasha@example.com', '/student/help'],
		['sibanda@example.com', '/parent/help'],
		['chipo@example.com', '/tutor/help']
	] as const) {
		const page = await as(browser, login);
		const r = await page.goto(path);
		expect(r?.status(), path).toBe(200);
		await expect(page.locator('h1')).toHaveText('How Tutora works');
		await expect(page.locator('main')).toContainText(/you only pay your tutor|takes no cut/);
	}
	const tutor = await as(browser, 'chipo@example.com');
	await tutor.goto('/tutor/more');
	await expect(tutor.locator('a[href="/tutor/help"]').first()).toBeVisible();
});
