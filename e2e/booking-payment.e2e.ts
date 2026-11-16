// Flow: student books → tutor accepts → lesson → Join link → mark done → student pays →
// tutor confirms → receipt for the student. Student, tutor (and parent view) talk to each other.
import { expect, test } from '@playwright/test';
import { as, closeDb, pick, press, sql } from './helpers.ts';

test.afterAll(closeDb);

test('booking to receipt, across student and tutor', async ({ browser }) => {
	const student = await as(browser, 'nyasha@example.com');
	const tutor = await as(browser, 'chipo@example.com');

	// 1. the student books a lesson (first free time)
	await student.goto('/student/book?tutor=chipo-moyo');
	const subj = student.locator('input[name=subjectId][type=radio]');
	if (await subj.count()) await pick(student, 'input[name=subjectId][type=radio]');
	await pick(student, '.day:not([hidden]) input[name=slot]');
	await press(student, 'form.stack > button.big[type=submit]');
	await expect(student).toHaveURL(/\/student\/book\/sent/);

	// 2. the tutor sees the request on Today and accepts it
	await tutor.goto('/tutor');
	const req = tutor.locator('article.request', { hasText: 'Nyasha' }).first();
	await expect(req).toBeVisible();
	await Promise.all([
		tutor.waitForLoadState('load'),
		req.getByRole('button', { name: /accept/i }).click()
	]);
	await expect(tutor.locator('.ok-box, .notice').first()).toBeVisible();

	// the student is told (bell) and sees the lesson
	const [l] = await sql<{ id: number }>(
		`select l.id from lesson l join attendee a on a.lesson_id = l.id
		 where a.user_id = 'test_nyasha' and l.tutor_id = 'test_chipo' and a.status = 'booked'
		 order by l.created_at desc limit 1`
	);
	expect(l).toBeTruthy();
	const [n] = await sql<{ n: number }>(
		`select count(*)::int n from notification where user_id = 'test_nyasha' and created_at > now() - interval '5 minutes'`
	);
	expect(n.n).toBeGreaterThan(0);
	// (the Lessons tab lists only the next few; earlier test runs may have left lessons today)
	const page = await student.goto(`/student/lessons/${l.id}`);
	expect(page?.status()).toBe(200);
	await expect(student.locator('main')).toContainText('Chipo');

	// 3. time moves on: the lesson starts now. Lessons happen in Teams / Meet / Zoom with the
	// tutor's link (Tutora's own video room is switched off): the old room address leads back to
	// the lesson, which shows the Join button, or says the tutor hasn't added the link yet
	await sql(
		`update lesson set starts_at = now() - interval '5 minutes', ends_at = now() + interval '55 minutes' where id = $1`,
		[l.id]
	);
	await student.goto(`/room/${l.id}`);
	await expect(student).toHaveURL(new RegExp(`/student/lessons/${l.id}`));
	await expect(student.locator('#join')).toContainText(/Join on|hasn't added the lesson link yet/);
	await tutor.goto(`/room/${l.id}`);
	await expect(tutor).toHaveURL(new RegExp(`/tutor/lessons/${l.id}\\?room=off`));
	await expect(tutor.locator('main')).toContainText(/Teams, Google Meet or Zoom/);

	// 4. the tutor marks the lesson done
	await tutor.goto(`/tutor/lessons/${l.id}`);
	await press(tutor, 'form[action="?/attendance"]:has(input[name=value][value=completed]) button');
	const [att] = await sql<{ attendance: string }>(
		`select attendance from attendee where lesson_id = $1 and user_id = 'test_nyasha'`,
		[l.id]
	);
	expect(att.attendance).toBe('completed');

	// 5. the student reports a payment (with proof)
	await student.goto('/student/payments?tutor=chipo-moyo');
	await student.fill('input[name=amount]', '10');
	await student.fill('input[name=reference]', 'E2E-' + l.id);
	await student.setInputFiles('input[name=proof]', {
		name: 'proof.png',
		mimeType: 'image/png',
		buffer: Buffer.from(
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
			'base64'
		)
	});
	await press(student, 'form[action*="/pay"] button[type=submit]');
	const [p] = await sql<{ id: number; status: string }>(
		`select id, status from payment where user_id = 'test_nyasha' and reference = $1`,
		['E2E-' + l.id]
	);
	expect(p.status).toBe('pending');

	// 6. the tutor confirms it on Earnings
	await tutor.goto('/tutor/payments');
	await press(tutor, `#confirm form[action="?/confirmPayment"]:has(input[value="${p.id}"]) button`);
	const [p2] = await sql<{ status: string; receipt_no: number | null }>(
		`select status, receipt_no from payment where id = $1`,
		[p.id]
	);
	expect(p2.status).toBe('confirmed');
	expect(p2.receipt_no).not.toBeNull();

	// 7. the student sees the receipt
	await student.goto('/student/payments?tutor=chipo-moyo&tab=history');
	await expect(student.locator(`a[href*="/receipt"]`).first()).toBeVisible();
});
