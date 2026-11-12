import { describe, expect, it } from 'vitest';
import {
	bestMatch,
	MAX_REPORT_BYTES,
	nameSimilarity,
	parseCsv,
	parseKahootReport,
	ReportFail,
	readXlsx,
	scoresFromRows,
	sharedStrings,
	sheetRows,
	xmlText
} from './kahoot.ts';

const te = new TextEncoder();

async function deflateRaw(data: Uint8Array) {
	const s = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'));
	return new Uint8Array(await new Response(s).arrayBuffer());
}

/** A minimal zip (tests only). CRCs are not checked by the reader, so they are left at 0. */
async function zip(files: Record<string, string>, deflate: boolean): Promise<Uint8Array> {
	const parts: Uint8Array[] = [];
	const central: Uint8Array[] = [];
	let offset = 0;
	for (const [name, text] of Object.entries(files)) {
		const raw = te.encode(text);
		const data = deflate ? await deflateRaw(raw) : raw;
		const n = te.encode(name);
		const local = new Uint8Array(30 + n.length);
		const dv = new DataView(local.buffer);
		dv.setUint32(0, 0x04034b50, true);
		dv.setUint16(4, 20, true);
		dv.setUint16(8, deflate ? 8 : 0, true);
		dv.setUint32(18, data.length, true);
		dv.setUint32(22, raw.length, true);
		dv.setUint16(26, n.length, true);
		local.set(n, 30);
		const c = new Uint8Array(46 + n.length);
		const cv = new DataView(c.buffer);
		cv.setUint32(0, 0x02014b50, true);
		cv.setUint16(4, 20, true);
		cv.setUint16(6, 20, true);
		cv.setUint16(10, deflate ? 8 : 0, true);
		cv.setUint32(20, data.length, true);
		cv.setUint32(24, raw.length, true);
		cv.setUint16(28, n.length, true);
		cv.setUint32(42, offset, true);
		c.set(n, 46);
		parts.push(local, data);
		central.push(c);
		offset += local.length + data.length;
	}
	const cdSize = central.reduce((a, c) => a + c.length, 0);
	const end = new Uint8Array(22);
	const ev = new DataView(end.buffer);
	ev.setUint32(0, 0x06054b50, true);
	ev.setUint16(8, central.length, true);
	ev.setUint16(10, central.length, true);
	ev.setUint32(12, cdSize, true);
	ev.setUint32(16, offset, true);
	const all = [...parts, ...central, end];
	const out = new Uint8Array(all.reduce((a, p) => a + p.length, 0));
	let o = 0;
	for (const p of all) {
		out.set(p, o);
		o += p.length;
	}
	return out;
}

/** A tiny Kahoot!-style report: an Overview sheet, then Final Scores with title rows. */
function reportFiles() {
	const strings = [
		'Algebra revision',
		'Rank',
		'Player',
		'Total Score (points)',
		'Correct Answers',
		'Incorrect Answers',
		'Tino D',
		'Rudo &amp; Co',
		'Overview'
	];
	const si = strings.map((s) => `<si><t>${s}</t></si>`).join('');
	const s = (i: number, ref: string) => `<c r="${ref}" t="s"><v>${i}</v></c>`;
	const n = (v: number, ref: string) => `<c r="${ref}"><v>${v}</v></c>`;
	return {
		'[Content_Types].xml': '<Types/>',
		'xl/workbook.xml': `<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Overview" sheetId="1" r:id="rId1"/><sheet name="Final Scores" sheetId="2" r:id="rId2"/></sheets></workbook>`,
		'xl/_rels/workbook.xml.rels': `<Relationships><Relationship Id="rId1" Type="ws" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="ws" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="ss" Target="sharedStrings.xml"/></Relationships>`,
		'xl/sharedStrings.xml': `<sst>${si}</sst>`,
		'xl/worksheets/sheet1.xml': `<worksheet><sheetData><row r="1">${s(8, 'A1')}</row></sheetData></worksheet>`,
		'xl/worksheets/sheet2.xml': `<worksheet><sheetData>
			<row r="1">${s(0, 'A1')}</row>
			<row r="3">${s(1, 'A3')}${s(2, 'B3')}${s(3, 'C3')}${s(4, 'D3')}${s(5, 'E3')}</row>
			<row r="4">${n(1, 'A4')}${s(6, 'B4')}${n(8450, 'C4')}${n(9, 'D4')}${n(1, 'E4')}</row>
			<row r="5">${n(2, 'A5')}${s(7, 'B5')}${n(5120, 'C5')}${n(6, 'D5')}${n(4, 'E5')}</row>
			<row r="6"><c r="A6"><v>3</v></c><c r="B6" t="inlineStr"><is><t>Farai</t></is></c><c r="C6"><v>0</v></c><c r="D6"><v>0</v></c><c r="E6"><v>10</v></c></row>
			<row r="8">${s(1, 'A8')}</row>
		</sheetData></worksheet>`
	};
}

describe('xlsx reading', () => {
	it('reads shared strings and cells by reference', () => {
		expect(
			sharedStrings(
				'<sst><si><t>a</t></si><si><r><t>b</t></r><r><t xml:space="preserve"> c</t></r></si></sst>'
			)
		).toEqual(['a', 'b c']);
		const rows = sheetRows(
			'<row r="1"><c r="C1" t="s"><v>0</v></c></row><row r="3"><c r="A3"><v>7</v></c></row>',
			['x']
		);
		expect(rows).toEqual([['', '', 'x'], [], ['7']]);
		expect(xmlText('a &amp; b &#65;&#x42;')).toBe('a & b AB');
	});

	it('parses a stored (uncompressed) report', async () => {
		const scores = await parseKahootReport(await zip(reportFiles(), false));
		expect(scores).toEqual([
			{ player: 'Tino D', correct: 9, incorrect: 1 },
			{ player: 'Rudo & Co', correct: 6, incorrect: 4 },
			{ player: 'Farai', correct: 0, incorrect: 10 }
		]);
	});

	it('parses a deflated report and lists its sheets', async () => {
		const b = await zip(reportFiles(), true);
		const sheets = await readXlsx(b);
		expect(sheets.map((s) => s.name)).toEqual(['Overview', 'Final Scores']);
		expect((await parseKahootReport(b)).length).toBe(3);
	});

	it('refuses broken, empty, too big or score-less files', async () => {
		await expect(parseKahootReport(new Uint8Array())).rejects.toBeInstanceOf(ReportFail);
		await expect(parseKahootReport(new Uint8Array(MAX_REPORT_BYTES + 1))).rejects.toThrow(
			'tools6_err_report_big'
		);
		await expect(parseKahootReport(te.encode('PK\u0003\u0004 not really a zip'))).rejects.toThrow(
			'tools6_err_report_format'
		);
		const files = reportFiles();
		files['xl/worksheets/sheet2.xml'] = '<worksheet><sheetData/></worksheet>';
		await expect(parseKahootReport(await zip(files, false))).rejects.toThrow(
			'tools6_err_report_noscores'
		);
	});
});

describe('csv reading', () => {
	it('handles quotes, semicolons and title rows', async () => {
		expect(parseCsv('a,"b, ""c"""\r\n1,2')).toEqual([
			['a', 'b, "c"'],
			['1', '2']
		]);
		const csv =
			'Final Scores\n\nRank;Player;Total Score;Correct Answers;Incorrect Answers\n1;"Tino D";900;9;1\n2;Rudo;500;5;5\n';
		expect(await parseKahootReport(te.encode(csv))).toEqual([
			{ player: 'Tino D', correct: 9, incorrect: 1 },
			{ player: 'Rudo', correct: 5, incorrect: 5 }
		]);
	});
	it('skips rows without numbers and stops at the first empty row', () => {
		expect(
			scoresFromRows([
				['Nickname', 'Correct', 'Incorrect'],
				['A', 'x', '1'],
				['B', '2', '3'],
				[],
				['C', '1', '1']
			])
		).toEqual([{ player: 'B', correct: 2, incorrect: 3 }]);
		expect(scoresFromRows([['Name', 'Score']])).toBeNull();
	});
});

describe('matching nicknames to students', () => {
	const students = [
		{ id: 's1', name: 'Tinotenda Dube' },
		{ id: 's2', name: 'Rudo Moyo' },
		{ id: 's3', name: 'Farai Ncube' }
	];
	it('scores similar names higher', () => {
		expect(nameSimilarity('Rudo Moyo', 'rudo  moyo')).toBe(1);
		expect(nameSimilarity('Rudo', 'Rudo Moyo')).toBeGreaterThan(0.7);
		expect(nameSimilarity('xyz', 'Rudo Moyo')).toBeLessThan(0.3);
	});
	it('preselects the likeliest student, or nobody', () => {
		expect(bestMatch('Rudo', students)).toBe('s2');
		expect(bestMatch('farai n', students)).toBe('s3');
		expect(bestMatch('Tinotend', students)).toBe('s1');
		expect(bestMatch('CoolCat99', students)).toBeNull();
	});
});
