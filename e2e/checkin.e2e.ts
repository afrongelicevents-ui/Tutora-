// Flow: a student checks in and shares it → studies → "How did it go?" follow-up →
// after the undo window the family is told (hourly job) → the parent sees the shared check-in.
import { expect, test } from '@playwright/test';
import { as, closeDb, press, runCron, sql } from './helpers.ts';

test.afterAll(closeDb);

test('check-in, share, follow-up, parent sees it', async ({ browser }) => {
	// setup: start Tatenda's day afresh (no check-ins today), so the question is asked
	await sql(
		`delete from checkin where student_id = 'test_tatenda' and created_at > now() - interval '1 day'`
	);
	await sql(
		`update study_session set status = 'stopped', ended_at = now() - interval '2 days' where student_id = 'test_tatenda' and status = 'running'`
	);
	const student = await as(browser, 'tatenda@example.com');
	const parent = await as(browser, 'sibanda@example.com');

	// 1. the student checks in: "I'm feeling confident"
	await student.goto('/student/progress');
	await press(student, 'form[action="?/checkin"] button[value=confident]');
	await expect(student.locator('.resp')).toContainText("I'm feeling confident");

	// 2. shares it with the family
	await press(student, 'form[action="?/shareAnswer"] button[value=yes]');
	const [c] = await sql<{ id: number; shared: boolean }>(
		`select id, shared_with_family shared from checkin where student_id = 'test_tatenda' and kind = 'start' order by created_at desc limit 1`
	);
	expect(c.shared).toBe(true);

	// 3. a short study session ends, so "How did it go?" is asked; the student answers
	await student.goto('/student/study');
	if (!(await student.locator('#focus').getAttribute('open')))
		await student.click('#focus summary');
	await student.fill('#fs-subject', 'Mathematics');
	await press(student, 'form[action="?/start"].stack button[type=submit]');
	await press(student, 'form[action="?/stop"] button, form[action="?/finish"] button');
	await student.goto('/student/progress');
	await expect(student.locator('.fu')).toBeVisible();
	await press(student, '.fu form[action="?/checkin"] button[value=motivated]');
	await expect(student.locator('.resp')).toContainText("I'm motivated");

	// 4. time moves past the 10-minute undo window
	await sql(
		`update checkin set created_at = created_at - interval '11 minutes' where student_id = 'test_tatenda' and created_at > now() - interval '1 hour'`
	);

	// 5. the hourly job tells the family (when the job's secret is set up locally)
	const ran = await runCron(student);
	if (ran) {
		expect(ran.shared).toBeGreaterThan(0);
		const [n] = await sql<{ n: number }>(
			`select count(*)::int n from notification where user_id = 'test_sibanda' and kind = 'family' and created_at > now() - interval '2 minutes'`
		);
		expect(n.n).toBeGreaterThan(0);
	} else
		test.info().annotations.push({
			type: 'note',
			description: 'cron secret not set locally: family note not sent'
		});

	// 6. the parent sees the shared check-in
	await parent.goto('/parent/personal?child=test_tatenda');
	await expect(parent.locator('main')).toContainText("I'm feeling confident");
});
