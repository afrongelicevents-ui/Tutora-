// Flows: the tutor saves a student's own meeting link → the child sees "Join lesson" at
// lesson time (not before) → the tutor marks the lesson done → the parent sees it happened.
// And: "Pay tutor" from a lesson → proof upload → the tutor confirms → receipt, for a student
// and for a parent paying for their child.
import { expect, test, type Page } from '@playwright/test';
import { as, closeDb, press, sql, uniq } from './helpers.ts';

test.afterAll(async () => {
	// the made-up lessons' charges must not stay on the test accounts' balances
	await sql(`update charge set voided = true where description = 'E2E lesson'`);
	await sql(
		`delete from meeting_link where tutor_id = 'test_chipo' and student_id = 'test_tatenda'`
	);
	await closeDb();
});

const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
	'base64'
);

/** A one-to-one online lesson with Chipo, starting `fromNowMin` minutes from now, with its charge. */
async function lessonFor(student: string, fromNowMin: number) {
	const [s] = await sql<{ id: number }>(
		`select id from subject where tutor_id = 'test_chipo' order by id limit 1`
	);
	const [l] = await sql<{ id: number }>(
		`insert into lesson (tutor_id, subject_id, mode, starts_at, ends_at, capacity)
		 values ('test_chipo', $1, 'online', now() + ($2 || ' minutes')::interval,
		         now() + ($2 || ' minutes')::interval + interval '1 hour', 1) returning id`,
		[s?.id ?? null, String(fromNowMin)]
	);
	const [a] = await sql<{ id: number }>(
		`insert into attendee (lesson_id, user_id, price_cents) values ($1, $2, 1000) returning id`,
		[l.id, student]
	);
	await sql(
		`insert into charge (tutor_id, user_id, kind, attendee_id, description, amount_cents)
		 values ('test_chipo', $1, 'lesson', $2, 'E2E lesson', 1000)`,
		[student, a.id]
	);
	return l.id;
}

async function sendProof(page: Page, ref: string) {
	await page.fill('input[name=amount]', '10');
	await page.fill('input[name=reference]', ref);
	await page.setInputFiles('input[name=proof]', {
		name: 'proof.png',
		mimeType: 'image/png',
		buffer: PNG
	});
	await press(page, 'form[action*="/pay"] button[type=submit]');
	await expect(page.locator('p.notice[role=status]')).toBeVisible();
}

async function confirmAsTutor(tutor: Page, ref: string) {
	const [p] = await sql<{ id: number; status: string }>(
		`select id, status from payment where reference = $1`,
		[ref]
	);
	expect(p.status).toBe('pending');
	await tutor.goto('/tutor/payments');
	await press(tutor, `#confirm form[action="?/confirmPayment"]:has(input[value="${p.id}"]) button`);
	const [p2] = await sql<{ status: string; receipt_no: number | null }>(
		`select status, receipt_no from payment where id = $1`,
		[p.id]
	);
	expect(p2.status).toBe('confirmed');
	expect(p2.receipt_no).not.toBeNull();
}

test('student link → Join lesson at lesson time → parent sees the lesson happened', async ({
	browser
}) => {
	const tutor = await as(browser, 'chipo@example.com');
	const child = await as(browser, 'tatenda@example.com');
	const parent = await as(browser, 'sibanda@example.com');
	const url = `https://zoom.us/j/9${String(Date.now()).slice(-9)}`;

	// 1. the tutor pastes a wrong link first: a clear error, nothing saved
	await tutor.goto('/tutor/students/test_tatenda');
	await expect(tutor.locator('#lesson-link')).toContainText(/waiting room or lobby/i);
	await tutor.fill('#meet-url', 'http://zoom.us/j/1234567890');
	await press(tutor, 'form[action="?/meetLink"] button[type=submit]');
	await expect(tutor.locator('#lesson-link [role=alert]')).toContainText('https://');
	// then the real one
	await tutor.fill('#meet-url', url);
	await press(tutor, 'form[action="?/meetLink"] button[type=submit]');
	await expect(tutor.locator('p.notice[role=status]')).toBeVisible();
	await expect(tutor.locator('#lesson-link')).toContainText('Zoom');

	// 2. a lesson later today: no join button yet
	const later = await lessonFor('test_tatenda', 180);
	await child.goto(`/student/lessons/${later}`);
	await expect(child.locator(`#join a[href="${url}"]`)).toHaveCount(0);
	await expect(child.locator('#join')).toContainText(/10 minutes before/i);

	// 3. a lesson starting in 5 minutes: "Join on Zoom" with the tutor's link, for both
	const now = await lessonFor('test_tatenda', 5);
	await child.goto(`/student/lessons/${now}`);
	await expect(child.locator(`#join a[href="${url}"]`)).toBeVisible();
	await expect(child.locator(`#join a[href="${url}"]`)).toContainText(/zoom/i);
	await child.goto('/student');
	await expect(child.locator('a.join-now')).toBeVisible();
	await tutor.goto(`/tutor/lessons/${now}`);
	await expect(tutor.locator(`a[href="${url}"]`)).toBeVisible();

	// 4. the lesson happens; the tutor marks it done
	await sql(
		`update lesson set starts_at = now() - interval '10 minutes', ends_at = now() + interval '50 minutes' where id = $1`,
		[now]
	);
	await tutor.goto(`/tutor/lessons/${now}`);
	await press(tutor, 'form[action="?/attendance"]:has(input[name=value][value=completed]) button');
	await sql(
		`update lesson set starts_at = now() - interval '3 hours', ends_at = now() - interval '2 hours' where id = $1`,
		[now]
	);

	// 5. the parent sees on the child page that the lesson happened
	await parent.goto('/parent/child/test_tatenda');
	await expect(parent.locator('[data-testid=child-past-lessons]')).toContainText(
		/lesson happened/i
	);
	await sql(`update lesson set status = 'cancelled' where id = $1`, [later]);
});

test('Pay tutor from a lesson → proof → tutor confirms → receipt (student and parent)', async ({
	browser
}) => {
	const tutor = await as(browser, 'chipo@example.com');
	const student = await as(browser, 'nyasha@example.com');
	const parent = await as(browser, 'sibanda@example.com');

	// a student pays from their lesson page
	const l = await lessonFor('test_nyasha', 60);
	await student.goto(`/student/lessons/${l}`);
	await Promise.all([
		student.waitForURL(/\/student\/payments\?tutor=chipo-moyo/),
		student.getByRole('link', { name: 'Pay tutor' }).first().click()
	]);
	const ref = `E2E-ML-${uniq()}`;
	await sendProof(student, ref);
	await confirmAsTutor(tutor, ref);
	await student.goto('/student/payments?tutor=chipo-moyo&tab=history');
	await expect(student.locator('a[href*="/receipt"]').first()).toBeVisible();

	// a parent pays for their child from the child page's lessons
	const c = await lessonFor('test_tatenda', 90);
	await parent.goto('/parent/child/test_tatenda');
	const pay = parent.locator('#lessons a', { hasText: 'Pay tutor' }).first();
	await expect(pay).toHaveAttribute('href', /child=test_tatenda.*tutor=chipo-moyo/);
	await Promise.all([parent.waitForURL(/\/parent\/payments\?/), pay.click()]);
	const ref2 = `E2E-ML-${uniq()}`;
	await sendProof(parent, ref2);
	const [who] = await sql<{ user_id: string }>(`select user_id from payment where reference = $1`, [
		ref2
	]);
	expect(who.user_id).toBe('test_tatenda');
	await confirmAsTutor(tutor, ref2);
	await parent.goto('/parent/payments?child=test_tatenda&tutor=chipo-moyo&tab=history');
	await expect(parent.locator('a[href*="/receipt"]').first()).toBeVisible();
	await sql(`update lesson set status = 'cancelled' where id = any($1)`, [[l, c]]);
});
