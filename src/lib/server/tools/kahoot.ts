/**
 * Kahoot! report import. Kahoot! has no public API a tutor's app can use for scores
 * (its Reports API is only for Kahoot! 360 enterprise organisations), so the tutor
 * downloads the game's report from Kahoot! (Reports → the game → Download report, .xlsx)
 * and uploads it here. We read the "Final Scores" sheet: player, correct and incorrect
 * answers. CSV works too. No outside libraries: a small zip reader and XML cell reader.
 */

export const MAX_REPORT_BYTES = 2 * 1024 * 1024;
const MAX_ENTRY_BYTES = 20 * 1024 * 1024; // unzipped size limit per entry (zip bombs)
const MAX_PLAYERS = 500;

/* ------------------------------------------------------------------ zip */

export class ReportFail extends Error {
	constructor(public code: string) {
		super(code);
	}
}

interface ZipEntry {
	name: string;
	method: number;
	compSize: number;
	size: number;
	offset: number;
}

function u16(b: Uint8Array, i: number) {
	return b[i] | (b[i + 1] << 8);
}
function u32(b: Uint8Array, i: number) {
	return (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
}

/** The entries listed in the zip's central directory. */
export function zipEntries(b: Uint8Array): ZipEntry[] {
	// end of central directory: signature 0x06054b50, within the last 64 KiB + 22 bytes
	let eocd = -1;
	for (let i = b.length - 22; i >= Math.max(0, b.length - 65_557); i--) {
		if (u32(b, i) === 0x06054b50) {
			eocd = i;
			break;
		}
	}
	if (eocd < 0) throw new ReportFail('tools6_err_report_format');
	const count = u16(b, eocd + 10);
	let p = u32(b, eocd + 16);
	const out: ZipEntry[] = [];
	const td = new TextDecoder();
	for (let n = 0; n < count; n++) {
		if (p + 46 > b.length || u32(b, p) !== 0x02014b50)
			throw new ReportFail('tools6_err_report_format');
		const method = u16(b, p + 10);
		const compSize = u32(b, p + 20);
		const size = u32(b, p + 24);
		const nameLen = u16(b, p + 28);
		const extraLen = u16(b, p + 30);
		const commentLen = u16(b, p + 32);
		const offset = u32(b, p + 42);
		const name = td.decode(b.subarray(p + 46, p + 46 + nameLen));
		out.push({ name, method, compSize, size, offset });
		p += 46 + nameLen + extraLen + commentLen;
	}
	return out;
}

async function inflateRaw(data: Uint8Array, limit: number): Promise<Uint8Array> {
	const stream = new Blob([data as BlobPart])
		.stream()
		.pipeThrough(new DecompressionStream('deflate-raw'));
	const reader = stream.getReader();
	const parts: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.length;
		if (total > limit) {
			await reader.cancel();
			throw new ReportFail('tools6_err_report_big');
		}
		parts.push(value);
	}
	const out = new Uint8Array(total);
	let o = 0;
	for (const part of parts) {
		out.set(part, o);
		o += part.length;
	}
	return out;
}

/** Read one entry (stored or deflated). */
export async function readEntry(b: Uint8Array, e: ZipEntry): Promise<Uint8Array> {
	const p = e.offset;
	if (p + 30 > b.length || u32(b, p) !== 0x04034b50)
		throw new ReportFail('tools6_err_report_format');
	const start = p + 30 + u16(b, p + 26) + u16(b, p + 28);
	const data = b.subarray(start, start + e.compSize);
	if (e.method === 0) return data;
	if (e.method === 8) return inflateRaw(data, MAX_ENTRY_BYTES);
	throw new ReportFail('tools6_err_report_format');
}

/* ------------------------------------------------------------------ xlsx */

const XML_ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
export function xmlText(s: string): string {
	return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
		if (e[0] === '#') {
			const code =
				e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
			return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
		}
		return XML_ENT[e] ?? m;
	});
}

const attr = (tag: string, name: string) =>
	tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? null;

/** Text of all <t> runs inside a fragment (shared string or inline string). */
function runsText(frag: string): string {
	let s = '';
	for (const m of frag.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) s += xmlText(m[1]);
	return s;
}

export function sharedStrings(xml: string): string[] {
	return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => runsText(m[1]));
}

/** "BC12" → column index 54 (0-based) */
function colIndex(ref: string): number {
	const letters = ref.match(/^[A-Z]+/)?.[0] ?? 'A';
	let n = 0;
	for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
	return n - 1;
}

/** A worksheet as rows of cell texts. */
export function sheetRows(xml: string, strings: string[]): string[][] {
	const rows: string[][] = [];
	for (const rm of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
		// rows left out of the file are empty rows: keep them, they end a table
		const num = Number(attr(rm[1], 'r'));
		while (Number.isInteger(num) && rows.length < num - 1 && rows.length < MAX_PLAYERS + 50)
			rows.push([]);
		const row: string[] = [];
		let next = 0;
		for (const cm of rm[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
			const tag = cm[1];
			const body = cm[2] ?? '';
			const ref = attr(tag, 'r');
			const idx = ref ? colIndex(ref) : next;
			next = idx + 1;
			const type = attr(tag, 't');
			const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
			let text = '';
			if (type === 's') text = strings[Number(v)] ?? '';
			else if (type === 'inlineStr') text = runsText(body);
			else if (v !== undefined) text = xmlText(v);
			if (idx < 200) row[idx] = text.trim();
		}
		rows.push(Array.from(row, (c) => c ?? ''));
		if (rows.length > MAX_PLAYERS + 50) break;
	}
	return rows;
}

/** All sheets of an .xlsx file, by name, in workbook order. */
export async function readXlsx(b: Uint8Array): Promise<{ name: string; rows: string[][] }[]> {
	const entries = zipEntries(b);
	const get = async (name: string) => {
		const e = entries.find((x) => x.name === name);
		return e ? new TextDecoder().decode(await readEntry(b, e)) : null;
	};
	const wb = await get('xl/workbook.xml');
	if (!wb) throw new ReportFail('tools6_err_report_format');
	const rels = (await get('xl/_rels/workbook.xml.rels')) ?? '';
	const ss = await get('xl/sharedStrings.xml');
	const strings = ss ? sharedStrings(ss) : [];
	const target = new Map<string, string>();
	for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
		const id = attr(m[0], 'Id');
		const t = attr(m[0], 'Target');
		if (id && t) target.set(id, t.startsWith('/') ? t.slice(1) : `xl/${t.replace(/^\.\//, '')}`);
	}
	const out: { name: string; rows: string[][] }[] = [];
	let i = 0;
	for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
		i++;
		const name = xmlText(attr(m[0], 'name') ?? `Sheet${i}`);
		const rid = attr(m[0], 'r:id');
		const path = (rid && target.get(rid)) || `xl/worksheets/sheet${i}.xml`;
		const xml = await get(path);
		if (xml) out.push({ name, rows: sheetRows(xml, strings) });
		if (i > 60) break;
	}
	return out;
}

/* ------------------------------------------------------------------ csv */

export function parseCsv(text: string): string[][] {
	const t = text.replace(/^\uFEFF/, '');
	// the delimiter that splits the busiest of the first lines most (title rows have none)
	const head = t.split(/\r?\n/, 30);
	const most = (d: string) => Math.max(0, ...head.map((l) => l.split(d).length));
	const delim = [',', ';', '\t'].reduce((a, d) => (most(d) > most(a) ? d : a));
	const rows: string[][] = [];
	let row: string[] = [];
	let cell = '';
	let q = false;
	for (let i = 0; i < t.length; i++) {
		const ch = t[i];
		if (q) {
			if (ch === '"' && t[i + 1] === '"') {
				cell += '"';
				i++;
			} else if (ch === '"') q = false;
			else cell += ch;
		} else if (ch === '"') q = true;
		else if (ch === delim) {
			row.push(cell.trim());
			cell = '';
		} else if (ch === '\n' || ch === '\r') {
			if (ch === '\r' && t[i + 1] === '\n') i++;
			row.push(cell.trim());
			rows.push(row);
			row = [];
			cell = '';
			if (rows.length > MAX_PLAYERS + 50) return rows;
		} else cell += ch;
	}
	if (cell || row.length) {
		row.push(cell.trim());
		rows.push(row);
	}
	return rows;
}

/* ------------------------------------------------------------------ scores */

export interface PlayerScore {
	player: string;
	correct: number;
	incorrect: number;
}

const norm = (s: string) =>
	s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();

/**
 * Find the header row (a "player"/"nickname" column plus "correct" and "incorrect" columns)
 * and read the players under it, until the first empty row.
 */
export function scoresFromRows(rows: string[][]): PlayerScore[] | null {
	for (let h = 0; h < Math.min(rows.length, 30); h++) {
		const cells = rows[h].map(norm);
		const player = cells.findIndex((c) => /^(player|players|nickname|player name|name)$/.test(c));
		const correct = cells.findIndex((c) =>
			/^(correct|correct answers|total correct)( count)?$/.test(c)
		);
		const incorrect = cells.findIndex((c) =>
			/^(incorrect|incorrect answers|wrong|wrong answers|total incorrect)( count)?$/.test(c)
		);
		if (player < 0 || correct < 0 || incorrect < 0) continue;
		const out: PlayerScore[] = [];
		for (const r of rows.slice(h + 1)) {
			const name = (r[player] ?? '').trim();
			if (!name) {
				if (out.length) break;
				continue;
			}
			const c = Number(r[correct]);
			const i = Number(r[incorrect]);
			if (!Number.isFinite(c) || !Number.isFinite(i) || c < 0 || i < 0) continue;
			out.push({ player: name.slice(0, 80), correct: Math.round(c), incorrect: Math.round(i) });
			if (out.length >= MAX_PLAYERS) break;
		}
		if (out.length) return out;
	}
	return null;
}

const looksLikeZip = (b: Uint8Array) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b;

/** Read a Kahoot! report (.xlsx or .csv). Prefers the "Final Scores" sheet. */
export async function parseKahootReport(b: Uint8Array): Promise<PlayerScore[]> {
	if (b.length === 0) throw new ReportFail('tools6_err_report_empty');
	if (b.length > MAX_REPORT_BYTES) throw new ReportFail('tools6_err_report_big');
	let sheets: { name: string; rows: string[][] }[];
	if (looksLikeZip(b)) sheets = await readXlsx(b);
	else {
		const text = new TextDecoder('utf-8', { fatal: false }).decode(b);
		if ([...text.slice(0, 2000)].some((ch) => ch.charCodeAt(0) < 9))
			throw new ReportFail('tools6_err_report_format');
		sheets = [{ name: 'csv', rows: parseCsv(text) }];
	}
	const ordered = [
		...sheets.filter((s) => /final\s*scores?/i.test(s.name)),
		...sheets.filter((s) => /overview/i.test(s.name)),
		...sheets
	];
	for (const s of ordered) {
		const found = scoresFromRows(s.rows);
		if (found) return found;
	}
	throw new ReportFail('tools6_err_report_noscores');
}

/* ------------------------------------------------------------------ matching names */

function bigrams(s: string) {
	const t = s.replace(/\s+/g, '');
	const out = new Map<string, number>();
	for (let i = 0; i < t.length - 1; i++) {
		const g = t.slice(i, i + 2);
		out.set(g, (out.get(g) ?? 0) + 1);
	}
	return out;
}

/** How alike a Kahoot! nickname and a student's name are, 0–1. */
export function nameSimilarity(nick: string, name: string): number {
	const a = norm(nick);
	const b = norm(name);
	if (!a || !b) return 0;
	if (a === b) return 1;
	const at = a.split(' ');
	const bt = b.split(' ');
	if (at.join('') === bt.join('')) return 0.95;
	// "Tino D" vs "Tinotenda Dube", "tino" vs "Tino Dube"
	if (at[0] === bt[0]) return at.length === 1 ? 0.85 : 0.8;
	if (bt.some((t) => t === a) || at.some((t) => t === bt[0])) return 0.75;
	const x = bigrams(a);
	const y = bigrams(b);
	let both = 0;
	let total = 0;
	for (const [g, n] of x) {
		both += Math.min(n, y.get(g) ?? 0);
		total += n;
	}
	for (const n of y.values()) total += n;
	return total ? (2 * both) / total : 0;
}

/** The likeliest student for a nickname, if alike enough (≥ 0.5). */
export function bestMatch<T extends { id: string; name: string }>(
	nick: string,
	students: T[]
): string | null {
	let best: string | null = null;
	let score = 0.5;
	for (const s of students) {
		const v = nameSimilarity(nick, s.name);
		if (v > score || (v === score && best === null)) {
			best = s.id;
			score = v;
		}
	}
	return best;
}
