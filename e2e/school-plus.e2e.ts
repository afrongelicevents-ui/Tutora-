// School+ through every status, with real accounts talking to each other:
// parent (Mrs Sibanda) for her child Tatenda, tutor (Chipo), and a NEW schoolteacher who
// makes their account through the tutor's invite link.
//   requested → tutor accepted → teacher invited → teacher accepted → consent → active → ended
// plus: tutor declines, teacher declines, parent withdraws, and a teacher sees nothing else.
import { expect, test, type Browser, type Page } from '@playwright/test';
import { as, closeDb, pick, press, sql, uniq } from './helpers.ts';

test.afterAll(closeDb);

const CHILD = 'test_tatenda';
const TEACHER_PW = 'Teacher-pass-123';

/** Mrs Sibanda asks for School+ for Tatenda; returns the new partnership id. */
async function request(parent: Page, tag: string) {
	await parent.goto(`/parent/school-plus?child=${CHILD}`);
	// the page's script takes over first (typing before that would be lost)
	await parent.waitForLoadState('networkidle');
	const form = parent.locator('[data-testid=sp-request]');
	await form.locator('select[name=tutor]').selectOption('test_chipo');
	await form.locator('input[name=subject]').fill(`Maths ${tag}`);
	await form.locator('input[name=school]').fill('Avondale High School');
	await form.locator('input[name=teacher]').fill('Mr Teacher');
	await press(parent, '[data-testid=sp-request] button[type=submit]');
	await expect(parent).toHaveURL(/\/parent\/school-plus\/\d+/);
	await expect(parent.locator('[data-testid=sp-parent]')).toHaveAttribute(
		'data-status',
		'requested'
	);
	return Number(new URL(parent.url()).pathname.split('/').pop());
}

const item = (tutor: Page, tag: string) =>
	tutor.locator('[data-testid=sp-item]', { hasText: `Maths ${tag}` }).first();

async function tutorAcceptsAndInvites(tutor: Page, tag: string) {
	await tutor.goto('/tutor/school-plus');
	await item(tutor, tag).locator('[data-testid=sp-accept] button').click();
	await tutor.waitForLoadState('load');
	await expect(item(tutor, tag)).toHaveAttribute('data-status', 'tutor_accepted');
	await item(tutor, tag).locator('[data-testid=sp-invite] button').click();
	await tutor.waitForLoadState('load');
	await expect(item(tutor, tag)).toHaveAttribute('data-status', 'teacher_invited');
	const link = await tutor.locator('[data-testid=sp-invite-link] input').inputValue();
	expect(link).toMatch(/\/school\/[0-9a-f]{48}$/);
	return new URL(link).pathname;
}

/**
 * A new teacher signs up from the invite link. Where email is switched on (local development)
 * they must confirm their address first: the test stands in for clicking the email link,
 * then logs in from the invite link, as a teacher would.
 */
async function teacherSignsUp(teacher: Page, invitePath: string, name: string, email: string) {
	await teacher.goto(invitePath);
	await teacher.waitForLoadState('networkidle');
	const signup = teacher.locator('[data-testid=spi-signup]');
	await signup.locator('input[name=name]').fill(name);
	await signup.locator('input[name=email]').fill(email);
	await signup.locator('input[name=password]').fill(TEACHER_PW);
	await signup.locator('input[name=school]').fill('Avondale High School');
	await teacher.waitForTimeout(2_100); // the sign-up form refuses anything faster (bot check)
	await press(teacher, '[data-testid=spi-signup] button[type=submit]');
	if (new URL(teacher.url()).pathname === '/verify-email') {
		await sql(`update "user" set email_verified = true where email = $1`, [email]);
		await teacher.goto(`/login?next=${encodeURIComponent(invitePath)}`);
		await teacher.fill('input[type=email], input[name=email]', email);
		await teacher.fill('input[type=password]', TEACHER_PW);
		await teacher.click('button[type=submit]');
		await teacher.waitForURL((u) => u.pathname === invitePath);
	}
	await expect(teacher).toHaveURL(new RegExp(invitePath));
}

async function freshContext(browser: Browser) {
	const size = test.info().project.use.viewport ?? { width: 390, height: 844 };
	return (await browser.newContext({ viewport: size })).newPage();
}

const status = async (id: number) =>
	(await sql<{ status: string }>(`select status from partnership where id = $1`, [id]))[0].status;

test.beforeEach(async () => {
	// earlier runs: nothing open for Tatenda (one open partnership per child)
	await sql(
		`update partnership set status = 'ended' where student_id = $1 and status in ('requested','tutor_accepted','teacher_invited','teacher_accepted','active')`,
		[CHILD]
	);
	await sql(`delete from action_limit where key like 'signup:%'`);
});

test('every status, end to end, with a new teacher account', async ({ browser }) => {
	const tag = uniq();
	const parent = await as(browser, 'sibanda@example.com');
	const tutor = await as(browser, 'chipo@example.com');
	const id = await request(parent, tag);
	expect(await status(id)).toBe('requested');

	const invitePath = await tutorAcceptsAndInvites(tutor, tag);
	expect(await status(id)).toBe('teacher_invited');

	// the teacher opens the link, makes a small account and accepts
	const teacher = await freshContext(browser);
	await teacherSignsUp(teacher, invitePath, 'Mr T. Chiganga', `teacher-${tag}@example.com`);
	// a real form POST from the invite page, as Chromium sends it: the page's referrer policy
	// must let the browser send the site's own Origin, or the CSRF check refuses it (403)
	const [post] = await Promise.all([
		teacher.waitForRequest((r) => r.method() === 'POST' && r.url().includes('/school/')),
		teacher.locator('[data-testid=spi-respond] button[value="1"]').click()
	]);
	expect(await post.headerValue('origin')).toBe(new URL(teacher.url()).origin);
	const res = await post.response();
	expect(res?.status()).toBeLessThan(400);
	await teacher.waitForURL(new RegExp(`/teacher/p/${id}`));
	await expect(teacher).toHaveURL(new RegExp(`/teacher/p/${id}`));
	await expect(teacher.locator('[data-testid=teacher-partnership]')).toHaveAttribute(
		'data-status',
		'teacher_accepted'
	);
	expect(await status(id)).toBe('teacher_accepted');

	// the parent gives written consent: active
	await parent.goto(`/parent/school-plus/${id}`);
	await parent.waitForLoadState('networkidle');
	const consent = parent.locator('[data-testid=sp-consent]');
	await pick(parent, '[data-testid=sp-consent] input[name=consent]');
	await consent.locator('input[name=consentName]').fill('Memory Sibanda');
	await press(parent, '[data-testid=sp-consent] button[type=submit]');
	await expect(parent.locator('[data-testid=sp-parent]')).toHaveAttribute('data-status', 'active');
	expect(await status(id)).toBe('active');

	// working together: teacher message, plan and monthly note; tutor answers
	await teacher.goto(`/teacher/p/${id}`);
	await teacher
		.locator('[data-testid=sp-message] textarea')
		.fill('Simultaneous equations next week.');
	await press(teacher, '[data-testid=sp-message] button[type=submit]');
	await teacher
		.locator('[data-testid=sp-plan]')
		.evaluate((f) => f.closest('details')?.setAttribute('open', ''));
	await teacher.locator('[data-testid=sp-plan] textarea[name=topics]').fill('Linear equations');
	await press(teacher, '[data-testid=sp-plan] button[type=submit]');
	await teacher
		.locator('[data-testid=sp-report]')
		.evaluate((f) => f.closest('details')?.setAttribute('open', ''));
	await teacher.locator('[data-testid=sp-report] textarea').fill('Good progress in class.');
	await press(teacher, '[data-testid=sp-report] button[type=submit]');
	await tutor.goto('/tutor/school-plus');
	await item(tutor, tag)
		.locator('[data-testid=sp-message] textarea')
		.fill('Thanks, will practise.');
	await press(
		tutor,
		`[data-testid=sp-item]:has-text("Maths ${tag}") [data-testid=sp-message] button[type=submit]`
	);

	// the parent reads it all (the log, the plan, the note) but can't post
	await parent.goto(`/parent/school-plus/${id}`);
	await expect(parent.getByText('Simultaneous equations next week.')).toBeVisible();
	await expect(parent.getByText('Thanks, will practise.')).toBeVisible();
	await expect(parent.locator('#plan').getByText('Linear equations')).toBeVisible();
	await expect(parent.getByText('Good progress in class.')).toBeVisible();

	// a teacher sees only this partnership: nothing else on Tutora
	const other = await sql<{ id: number }>(
		`select id from partnership where id <> $1 order by id desc limit 1`,
		[id]
	);
	if (other[0]) {
		const r = await teacher.goto(`/teacher/p/${other[0].id}`);
		expect(r?.status()).toBe(404);
	}
	for (const path of ['/student', '/parent', '/tutor']) {
		await teacher.goto(path);
		expect(new URL(teacher.url()).pathname).not.toBe(path);
	}

	// the teacher ends it
	await teacher.goto(`/teacher/p/${id}`);
	await teacher
		.locator('[data-testid=sp-end]')
		.evaluate((f) => f.closest('details')?.setAttribute('open', ''));
	await pick(teacher, '[data-testid=sp-end] input[name=sure]');
	await press(teacher, '[data-testid=sp-end] button[type=submit]');
	expect(await status(id)).toBe('ended');
	await parent.goto(`/parent/school-plus/${id}`);
	await expect(parent.locator('[data-testid=sp-parent]')).toHaveAttribute('data-status', 'ended');

	// the notifications reached each side
	const [n] = await sql<{ n: number }>(
		`select count(*)::int n from notification where user_id = 'test_sibanda' and link like '/parent/school-plus%' and created_at > now() - interval '10 minutes'`
	);
	expect(n.n).toBeGreaterThan(2);
});

test('declines and withdrawal', async ({ browser }) => {
	const parent = await as(browser, 'sibanda@example.com');
	const tutor = await as(browser, 'chipo@example.com');

	// the tutor declines
	const a = uniq();
	const id1 = await request(parent, a);
	await tutor.goto('/tutor/school-plus');
	// without the "I'm sure" tick nothing happens; with it the request is declined
	await item(tutor, a).locator('details:has([data-testid=sp-decline]) summary').click();
	await item(tutor, a).locator('[data-testid=sp-decline] button').click();
	await tutor.waitForLoadState('load');
	expect(await status(id1)).toBe('requested');
	await item(tutor, a).locator('details:has([data-testid=sp-decline]) summary').click();
	await item(tutor, a).locator('[data-testid=sp-decline] input[name=sure]').check();
	await item(tutor, a).locator('[data-testid=sp-decline] button').click();
	await tutor.waitForLoadState('load');
	expect(await status(id1)).toBe('declined');

	// the teacher declines (a teacher who already has an account logs in from the link)
	const b = uniq();
	const id2 = await request(parent, b);
	const invitePath = await tutorAcceptsAndInvites(tutor, b);
	const teacher = await freshContext(browser);
	await teacherSignsUp(teacher, invitePath, 'Mrs No', `teacher-${b}@example.com`);
	await press(teacher, '[data-testid=spi-respond] button[value="0"]');
	expect(await status(id2)).toBe('declined');
	// a clear confirmation after declining
	await expect(teacher.locator('[data-testid=spi-answered]')).toHaveAttribute(
		'data-answered',
		'declined'
	);
	// reopening the used link: a friendly "already answered" page, not a 404
	const again = await teacher.goto(invitePath);
	expect(again?.status()).toBe(200);
	await expect(teacher.locator('[data-testid=spi-answered]')).toHaveAttribute(
		'data-answered',
		'declined'
	);
	await expect(teacher.locator('[data-testid=spi-respond]')).toHaveCount(0);

	// the parent withdraws a request before it starts
	const c = uniq();
	const id3 = await request(parent, c);
	await tutorAcceptsAndInvites(tutor, c);
	await parent.goto(`/parent/school-plus/${id3}`);
	await parent.waitForLoadState('networkidle');
	await press(parent, '[data-testid=sp-stop] button[type=submit]');
	expect(await status(id3)).not.toBe('withdrawn'); // not without the tick
	await parent.locator('[data-testid=sp-stop] input[name=sure]').check();
	await press(parent, '[data-testid=sp-stop] button[type=submit]');
	expect(await status(id3)).toBe('withdrawn');
});

test('find a tutor first: no request without a tutor', async ({ browser }) => {
	const parent = await as(browser, 'sibanda@example.com');
	// for this test only: Tatenda has no tutor (put back afterwards)
	const saved = await sql<{ tutor_id: string }>(
		`delete from enrollment where user_id = $1 returning tutor_id`,
		[CHILD]
	);
	try {
		await parent.goto(`/parent/school-plus?child=${CHILD}`);
		await expect(parent.locator('[data-testid=sp-find-tutor]')).toBeVisible();
	} finally {
		for (const r of saved)
			await sql(
				`insert into enrollment (tutor_id, user_id) values ($1, $2) on conflict do nothing`,
				[r.tutor_id, CHILD]
			);
	}
});
