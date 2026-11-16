import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { freshDb, hasTestDb } from './testing/db.ts';
import { makeUser } from './testing/fixtures.ts';
import type { DB } from './db/types.ts';
import {
	createReport,
	sendReport,
	sentReport,
	sentReportsFor,
	studentReports,
	updateReport
} from './reports.ts';
import { reportPdfData } from './report-file.ts';
import { familyFeatureFor } from '../family-features.ts';

describe.skipIf(!hasTestDb)('Students see their own reports (real database)', () => {
	let db: DB;
	let close: () => Promise<void>;
	let tid: string;
	let sid: string;
	let other: string;
	beforeAll(async () => {
		({ db, close } = await freshDb());
		tid = (await makeUser(db, 'tutor', 'Tutor One')).id;
		sid = (await makeUser(db, 'student', 'Tatenda Moyo', tid)).id;
		other = (await makeUser(db, 'student', 'Rudo Banda', tid)).id;
	});
	afterAll(async () => close?.());

	const period = { from: '2026-10-01', to: '2026-10-31' };

	it('a note is for the parents only unless the tutor shows it to the student', async () => {
		const r = await createReport(db, tid, sid, period, 'Needs to sleep earlier (parents)');
		expect(r.noteVisible).toBe(false);
		// a draft is never shown to the student
		expect(await studentReports(db, sid)).toHaveLength(0);
		await sendReport(db, tid, r.id);

		const mine = await studentReports(db, sid);
		expect(mine).toHaveLength(1);
		expect(mine[0].note).toBeNull();
		expect(JSON.stringify(mine)).not.toContain('sleep earlier');
		// the parent still sees the note
		expect((await sentReportsFor(db, sid))[0].note).toBe('Needs to sleep earlier (parents)');

		// the student's PDF has no note; the family's has it
		const row = (await sentReport(db, sid, r.id))!;
		expect((await reportPdfData(db, row, { forStudent: true })).note).toBeNull();
		expect((await reportPdfData(db, row)).note).toContain('sleep earlier');

		// the tutor shows the note to the student
		await updateReport(db, tid, r.id, 'Well done on algebra!', new Date(), true);
		const shown = await studentReports(db, sid);
		expect(shown[0].note).toBe('Well done on algebra!');
		const row2 = (await sentReport(db, sid, r.id))!;
		expect((await reportPdfData(db, row2, { forStudent: true })).note).toBe(
			'Well done on algebra!'
		);
		// saving without the choice keeps it as it was
		await updateReport(db, tid, r.id, 'Well done on algebra!!');
		expect((await studentReports(db, sid))[0].note).toBe('Well done on algebra!!');
		// and back to parent only
		await updateReport(db, tid, r.id, 'Private again', new Date(), false);
		expect((await studentReports(db, sid))[0].note).toBeNull();
	});

	it('a student sees only their own sent reports', async () => {
		const r = await createReport(db, tid, other, period, 'About Rudo', new Date(), true);
		await sendReport(db, tid, r.id);
		const mine = await studentReports(db, sid);
		expect(mine.every((x) => x.id !== r.id)).toBe(true);
		expect(await sentReport(db, sid, r.id)).toBeNull();
		expect((await studentReports(db, other)).map((x) => x.id)).toEqual([r.id]);
	});

	it('the report pages are a Tutora Family feature, like the parent report', () => {
		expect(familyFeatureFor('/student/reports/3')).toBe('report');
		expect(familyFeatureFor('/student/reports/3/pdf')).toBe('report');
		expect(familyFeatureFor('/student/report')).toBeNull();
	});
});
