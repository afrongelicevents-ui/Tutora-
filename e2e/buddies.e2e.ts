// Flow: two under-13 students swap a Study Buddies code → the link waits for each child's
// guardian → both guardians approve → both students see the buddy. A decline tells both.
import { expect, test, type Page } from '@playwright/test';
import { as, closeDb, press, sql } from './helpers.ts';

const A = 'test_tatenda'; // guardian: Sibanda
const B = 'test_kuda'; // guardian: Peter (set up below)

test.beforeAll(async () => {
	// setup only: both are under 13, Kuda has a guardian, and they are not buddies yet
	await sql(`update student_card set birth_date = '2015-01-01' where user_id in ($1, $2)`, [A, B]);
	await sql(
		`insert into family_link (parent_id, student_id, guardian, status) values ('test_peter', $1, true, 'active') on conflict do nothing`,
		[B]
	);
	await sql(`delete from buddy_link where (a_id = $1 and b_id = $2) or (a_id = $2 and b_id = $1)`, [
		A,
		B
	]);
	await sql(`delete from buddy_block where blocker_id in ($1, $2)`, [A, B]);
});

test.afterAll(async () => {
	await sql(`update student_card set birth_date = '2011-03-04' where user_id = $1`, [A]);
	await sql(`update student_card set birth_date = '2012-03-04' where user_id = $1`, [B]);
	await sql(`delete from buddy_link where (a_id = $1 and b_id = $2) or (a_id = $2 and b_id = $1)`, [
		A,
		B
	]);
	await sql(`delete from family_link where parent_id = 'test_peter' and student_id = $1`, [B]);
	await closeDb();
});

async function swapCodes(a: Page, b: Page) {
	await a.goto('/student/buddies');
	await press(a, 'form[action="?/newCode"] button');
	const code = (await a.locator('.code-card .code').textContent())?.trim() ?? '';
	await b.goto('/student/buddies');
	await b.fill('#bd-code', code);
	await press(b, 'form[action="?/add"] button[type=submit]');
	await expect(b.locator('.notice')).toBeVisible();
}

const linkStatus = async () =>
	(
		await sql<{ status: string }>(
			`select status from buddy_link where (a_id = $1 and b_id = $2) or (a_id = $2 and b_id = $1)`,
			[A, B]
		)
	)[0]?.status ?? null;

async function decide(parent: Page, child: string, approve: boolean) {
	await parent.goto(`/parent/buddies?child=${child}`);
	await press(
		parent,
		`form[action="?/decide"]:has(input[name=approve][value="${approve ? 1 : 0}"]) button`
	);
	await expect(parent.locator('.notice')).toBeVisible();
}

test('under-13 buddies need each guardian; decline tells both', async ({ browser }) => {
	const a = await as(browser, 'tatenda@example.com');
	const b = await as(browser, 'kuda@example.com');
	const pa = await as(browser, 'sibanda@example.com');
	const pb = await as(browser, 'peter@example.com');

	// 1. code swap: the link waits for the guardians
	await swapCodes(a, b);
	expect(await linkStatus()).toBe('pending');
	await expect(b.locator('ul.list.pending li')).toHaveCount(1);
	// both guardians were asked
	const [asked] = await sql<{ n: number }>(
		`select count(*)::int n from notification where user_id in ('test_sibanda', 'test_peter') and created_at > now() - interval '1 minute' and link like '/parent/buddies%'`
	);
	expect(asked.n).toBeGreaterThanOrEqual(2);

	// 2. one guardian approves: still waiting for the other
	await decide(pa, A, true);
	expect(await linkStatus()).toBe('pending');
	// 3. the second approves: they are buddies, both see each other
	await decide(pb, B, true);
	expect(await linkStatus()).toBe('active');
	for (const p of [a, b]) {
		await p.goto('/student/buddies');
		await expect(p.locator('ul.list:not(.pending) li a[href^="/student/buddies/"]')).toHaveCount(1);
	}

	// 4. decline case: they stop, swap again, a guardian says no → link gone, both told
	await sql(`delete from buddy_link where (a_id = $1 and b_id = $2) or (a_id = $2 and b_id = $1)`, [
		A,
		B
	]);
	await swapCodes(b, a);
	expect(await linkStatus()).toBe('pending');
	await decide(pa, A, false);
	expect(await linkStatus()).toBeNull();
	const told = await sql<{ user_id: string }>(
		`select distinct user_id from notification where user_id in ($1, $2) and title = 'Study buddy not approved' and created_at > now() - interval '1 minute'`,
		[A, B]
	);
	expect(told.length).toBe(2);
});
