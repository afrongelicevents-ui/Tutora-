import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { freshDb, hasTestDb } from './testing/db.ts';
import { makeUser } from './testing/fixtures.ts';
import type { DB } from './db/types.ts';
import { familyLink } from './db/v3.schema.ts';
import {
	childCovered,
	confirmInvoice,
	createCheckoutInvoice,
	familyCoverage,
	familyHomeStrip,
	saveTutoraSettings
} from './family-billing.ts';
import { giveGift } from './plan-gifts.ts';
import { parentFamilyGate } from './family-gate.ts';
import { familyFeatureFor } from '../family-features.ts';

/** a request as hooks.server.ts sees it (only what the gate reads) */
function event(
	db: DB,
	parentId: string,
	path: string,
	opts: { cookie?: string; form?: string } = {}
) {
	const url = new URL('http://localhost' + path);
	const body = opts.form ? new URLSearchParams({ child: opts.form }) : undefined;
	return {
		locals: { db, user: { id: parentId, role: 'parent' } },
		url,
		isDataRequest: false,
		request: new Request(url, body ? { method: 'POST', body } : {}),
		cookies: { get: (n: string) => (n === 'tutora_child' ? opts.cookie : undefined) }
	} as unknown as RequestEvent;
}

describe.skipIf(!hasTestDb)('Tutora Family per child (a plan for 1 of 3 children)', () => {
	let db: DB;
	let close: () => Promise<void>;
	const now = new Date();
	let parent: { id: string };
	let kids: { id: string }[];

	beforeAll(async () => {
		({ db, close } = await freshDb());
		await saveTutoraSettings(db, { pilotFreeTrial: false, trialDays: 14 });
		parent = await makeUser(db, 'parent', 'Mrs Three', null);
		kids = [];
		for (let i = 0; i < 3; i++) {
			const k = await makeUser(db, 'student', `Kid ${i + 1} Three`, null);
			await db.insert(familyLink).values({ parentId: parent.id, studentId: k.id, guardian: true });
			kids.push(k);
		}
		// the parent pays for the first child only; the owner confirms
		const owner = await makeUser(db, 'owner', 'Owner', null);
		const inv = await createCheckoutInvoice(db, parent.id, [kids[0].id], 1, now);
		await confirmInvoice(db, owner.id, inv.id, undefined, now);
	});
	afterAll(async () => close?.());

	it('covers only the child that was paid for', async () => {
		expect(await familyCoverage(db, parent.id, now)).toEqual({ all: false, covered: [kids[0].id] });
		expect(await childCovered(db, parent.id, kids[0].id, now)).toBe(true);
		expect(await childCovered(db, parent.id, kids[1].id, now)).toBe(false);
		expect(await childCovered(db, parent.id, kids[2].id, now)).toBe(false);
		const strip = await familyHomeStrip(db, parent.id, now);
		expect(strip.all).toBe(false);
		expect(strip.covered).toEqual([kids[0].id]);
	});

	it("opens the covered child's Family pages and refuses the other two", async () => {
		const gate = (path: string, o?: { cookie?: string; form?: string }) =>
			parentFamilyGate(event(db, parent.id, path, o), familyFeatureFor(path.split('?')[0])!);
		// the covered child
		expect(await gate(`/parent/progress?child=${kids[0].id}`)).toBeNull();
		expect(await gate(`/parent/report?child=${kids[0].id}`)).toBeNull();
		expect(await gate(`/parent/child/${kids[0].id}/reports/1/pdf`)).toBeNull();
		// the other two: to their own (free) page with "Add this child to Tutora Family"
		for (const k of kids.slice(1)) {
			for (const path of [
				`/parent/progress?child=${k.id}`,
				`/parent/report?child=${k.id}`,
				`/parent/personal?child=${k.id}`,
				`/parent/school-plus?child=${k.id}`,
				`/parent/child/${k.id}/reports/1/pdf`
			]) {
				const r = await gate(path);
				expect(r?.status, path).toBe(303);
				expect(r?.headers.get('location')).toMatch(new RegExp(`^/parent/child/${k.id}\\?locked=`));
			}
		}
		// a form post for an uncovered child is refused too (not only the page)
		const post = await gate('/parent/school-plus?/request', { form: kids[1].id });
		expect(post?.status).toBe(303);
		const ok = await gate('/parent/school-plus?/request', { form: kids[0].id });
		expect(ok).toBeNull();
		// no child chosen and the last one chosen is not covered: the covered child is opened
		const def = await gate('/parent/progress', { cookie: kids[2].id });
		expect(def?.headers.get('location')).toBe(`/parent/progress?child=${kids[0].id}`);
		// a child of another family: left to the page (not found), never opened by the gate
		const other = await makeUser(db, 'student', 'Not Mine', null);
		expect(await gate(`/parent/progress?child=${other.id}`)).toBeNull();
	});

	it('the pilot or a Family gift opens every child', async () => {
		const owner = await makeUser(db, 'owner', 'Owner Two', null);
		const p = await makeUser(db, 'parent', 'Mr Gift', null);
		const k = await makeUser(db, 'student', 'Gift Kid', null);
		await db.insert(familyLink).values({ parentId: p.id, studentId: k.id, guardian: true });
		expect(await childCovered(db, p.id, k.id, now)).toBe(false);
		// with no child covered at all: the Plans page, as before
		const r = await parentFamilyGate(event(db, p.id, `/parent/progress?child=${k.id}`), 'progress');
		expect(r?.headers.get('location')).toBe('/parent/plans?locked=progress');
		await giveGift(db, owner.id, { userId: p.id, plan: 'family', note: 'test' });
		expect(await familyCoverage(db, p.id, now)).toEqual({ all: true, covered: [] });
		await saveTutoraSettings(db, { pilotFreeTrial: true, trialDays: 14 });
		expect((await familyCoverage(db, parent.id, now)).all).toBe(true);
		await saveTutoraSettings(db, { pilotFreeTrial: false, trialDays: 14 });
	});
});
