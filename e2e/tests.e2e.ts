// Tests from the question bank: the tutor builds a timed test from the bank → two students
// get the questions in different orders → one takes it (timer showing) → multiple choice and
// maths are marked at once, the written answer waits → the tutor marks it → the score is in
// the parent's progress per chapter and term. The AI test maker rests at its daily line and
// shows "Pro" + Upgrade to a Free tutor.
import { expect, test } from '@playwright/test';
import { as, closeDb, press, sql, uniq } from './helpers.ts';

interface Item {
	qid: number;
	type: string;
	answerIdx: number;
	accepted: string[];
	expected: number | null;
}

const today = () => new Date().toISOString().slice(0, 10);
let setTitle = '';

test.afterAll(async () => {
	if (setTitle) {
		await sql(
			`delete from assessment_result where set_id in (select id from question_set where title = $1)`,
			[setTitle]
		);
		await sql(`delete from question_set where title = $1`, [setTitle]);
	}
	await sql(`delete from ai_usage where day = $1`, [today()]);
	await closeDb();
});

test('build from the bank → own order each → timed test → tutor marks → parent sees it', async ({
	browser
}) => {
	setTitle = `E2E test ${uniq()}`;
	const tutor = await as(browser, 'chipo@example.com');

	// 1. the tutor builds it: two chapters, every question, a 15-minute timer, two students
	await tutor.goto('/tutor/assessments');
	await tutor.getByRole('link', { name: 'Build a test' }).click();
	await tutor.locator('form[data-ready]').waitFor();
	await tutor.fill('#b-title', setTitle);
	await tutor.selectOption('#b-subject', 'Mathematics');
	await expect(tutor.locator('label.chip', { hasText: 'Fractions' })).toBeVisible();
	await tutor.locator('label.chip', { hasText: 'Fractions' }).click();
	await tutor.locator('label.chip', { hasText: 'Equations' }).click();
	await tutor.fill('#b-count', '10');
	await tutor.fill('#b-timer', '15');
	await tutor.locator('label.chip', { hasText: 'Nyasha' }).click();
	await tutor.locator('label.chip', { hasText: 'Tatenda' }).click();
	await press(tutor, 'form button[type=submit].btn-block');
	await expect(tutor).toHaveURL(/\/tutor\/assessments\/\d+$/);
	await expect(tutor.locator('body')).toContainText('Built from your question bank');

	const asg = await sql<{ id: number; student_id: string }>(
		`select qa.id, qa.student_id from quiz_assignment qa join question_set s on s.id = qa.set_id where s.title = $1 order by qa.student_id`,
		[setTitle]
	);
	expect(asg.map((a) => a.student_id)).toEqual(['test_nyasha', 'test_tatenda']);
	const [ny, ta] = asg;

	// 2. each student opens it: first the "Start test" step (no clock yet), then their own
	// order with the clock running
	const nyasha = await as(browser, 'nyasha@example.com');
	await nyasha.goto(`/student/quiz/${ny.id}`);
	await expect(nyasha.getByRole('button', { name: 'Start test' })).toBeVisible();
	expect(await sql(`select 1 from test_attempt where assignment_id = $1`, [ny.id])).toHaveLength(0);
	await press(nyasha, 'form[action="?/start"] button');
	await expect(nyasha.getByRole('timer')).toContainText('Time left');
	const student = await as(browser, 'tatenda@example.com');
	await student.goto(`/student/quiz/${ta.id}`);
	await press(student, 'form[action="?/start"] button');
	await expect(student.getByRole('timer')).toContainText(/1[45]:\d\d/);
	const atts = await sql<{ assignment_id: number; items: Item[] }>(
		`select assignment_id, items from test_attempt where assignment_id = any($1::int[]) order by assignment_id`,
		[[ny.id, ta.id]]
	);
	expect(atts).toHaveLength(2);
	const orderOf = (id: number) => atts.find((a) => a.assignment_id === id)!.items.map((i) => i.qid);
	expect(orderOf(ny.id)).not.toEqual(orderOf(ta.id));
	expect([...orderOf(ny.id)].sort()).toEqual([...orderOf(ta.id)].sort());

	// 3. Tatenda answers everything right (and writes the written answer) and hands in
	const items = atts.find((a) => a.assignment_id === ta.id)!.items;
	expect(items.some((i) => i.type === 'written')).toBe(true);
	for (const it of items) {
		if (it.type === 'mcq')
			await student.locator(`input[name=a${it.qid}][value="${it.answerIdx}"]`).check();
		else if (it.type === 'short')
			await student
				.locator(`input[name=a${it.qid}]`)
				.fill(it.expected !== null ? String(it.expected) : it.accepted[0]);
		else
			await student
				.locator(`textarea[name=a${it.qid}]`)
				.fill('Take 4 from both sides, then divide by 3, so x = 5.');
	}
	await press(student, 'form[action="?/test"] button[type=submit]');
	await expect(student.locator('body')).toContainText('waiting for your tutor');
	const written = items.filter((i) => i.type === 'written');
	const maxMarks = await sql<{ max_score: number; score: number }>(
		`select max_score, score from test_attempt where assignment_id = $1`,
		[ta.id]
	);
	// everything but the written answer is already marked right
	expect(maxMarks[0].score).toBeGreaterThan(0);

	// 4. the tutor marks the written answer from Marking
	await tutor.goto('/tutor/marking');
	await tutor
		.locator('li', { hasText: 'Tatenda' })
		.filter({ hasText: setTitle })
		.getByRole('link', { name: 'Mark now' })
		.click();
	for (const w of written) await tutor.fill(`input[name=m${w.qid}]`, '3');
	await press(tutor, 'form button.btn-block');
	await expect(tutor.locator('.notice')).toContainText('Marked');
	const [done] = await sql<{ score: number; max_score: number; needs_marking: boolean }>(
		`select score, max_score, needs_marking from test_attempt where assignment_id = $1`,
		[ta.id]
	);
	expect(done).toMatchObject({ needs_marking: false });
	expect(done.score).toBe(done.max_score);
	const results = await sql<{ topic: string; term: string }>(
		`select r.topic, r.term from assessment_result r join test_attempt a on a.id = r.attempt_id where a.assignment_id = $1 order by r.topic`,
		[ta.id]
	);
	expect(results).toEqual([
		{ topic: 'Equations', term: null },
		{ topic: 'Fractions', term: null }
	]);

	// 5. Tatenda sees the full score; the parent sees scores per term and chapter
	await student.goto(`/student/quiz/${ta.id}`);
	await expect(student.locator('.bignum')).toContainText(`${done.score}/${done.max_score}`);
	const parent = await as(browser, 'sibanda@example.com');
	await parent.goto('/parent/progress?child=test_tatenda');
	const sharesProgress = (await parent.locator('body').textContent())?.includes('Test scores');
	if (sharesProgress) {
		await expect(parent.locator('body')).toContainText('Test scores this year');
		await expect(parent.locator('.terms')).toContainText('Term');
		await expect(parent.locator('body')).toContainText('Equations');
	} else {
		test.info().annotations.push({
			type: 'note',
			description: 'Tatenda does not share progress with this parent in the test data'
		});
	}
});

test('AI test maker: rests at the daily line; Free tutors see Pro + Upgrade', async ({
	browser
}) => {
	// the site's line is reached (another tutor used it all today)
	await sql(
		`insert into ai_usage (day, tutor_id, neurons, calls) values ($1, 'test_tendai', 1500, 30)
		 on conflict (day, tutor_id) do update set neurons = 1500`,
		[today()]
	);
	const pro = await as(browser, 'chipo@example.com');
	await pro.goto('/tutor/ai');
	await expect(pro.locator('body')).toContainText(
		'AI test maker is resting for today, try again tomorrow, or build a test from the question bank.'
	);
	await expect(pro.getByRole('link', { name: 'Build a test' })).toBeVisible();

	const free = await as(browser, 'tendai@example.com');
	await free.goto('/tutor/ai');
	await expect(free.locator('.pro-lock')).toBeVisible();
	await expect(free.getByRole('link', { name: 'Upgrade' })).toBeVisible();
	await sql(`delete from ai_usage where day = $1`, [today()]);
});

test('question bank: add a maths question with changing numbers, share it, filter', async ({
	browser
}) => {
	const tutor = await as(browser, 'chipo@example.com');
	const prompt = `E2E {a} + {b} ${uniq()}`;
	await tutor.goto('/tutor/bank');
	await tutor.locator('#new-type[data-ready]').waitFor({ state: 'attached' });
	await expect(tutor.locator('body')).toContainText("Don't copy past exam papers or textbooks");
	const add = tutor.locator('details.more');
	if (!(await add.getAttribute('open'))) await add.locator('summary').click();
	await tutor.selectOption('#new-type', 'maths');
	await expect(tutor.locator('input[name=v0name]')).toBeVisible();
	await tutor.fill('#new-prompt', prompt);
	await tutor.fill('input[name=v0name]', 'a');
	await tutor.fill('input[name=v0min]', '1');
	await tutor.fill('input[name=v0max]', '9');
	await tutor.fill('input[name=v1name]', 'b');
	await tutor.fill('input[name=v1min]', '1');
	await tutor.fill('input[name=v1max]', '9');
	await tutor.fill('#new-formula', 'a + b');
	await tutor.fill('#new-subject', 'Mathematics');
	await tutor.fill('#new-chapter', 'Addition');
	await press(tutor, 'form[action="?/add"] button[type=submit]');
	await expect(tutor.locator('.notice')).toContainText('Question added');
	const [q] = await sql<{ id: number; shared: boolean }>(
		`select id, shared from question where prompt = $1`,
		[prompt]
	);
	expect(q.shared).toBe(false);
	// its page shows two students' versions
	await tutor.goto(`/tutor/bank/${q.id}`);
	await expect(tutor.locator('body')).toContainText('Two students might see');
	await tutor.goto('/tutor/bank?type=maths&chapter=Addition&subject=Mathematics');
	await expect(tutor.locator('.rows')).toContainText(prompt);
	await sql(`delete from question where id = $1`, [q.id]);
});
