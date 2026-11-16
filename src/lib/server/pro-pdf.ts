/**
 * Tutora Pro PDFs: a simple branded table document (earnings report, invoice). Standard
 * fonts only (no font files to load), A4, several pages when the table is long.
 */
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';

/** Standard fonts only cover basic Latin; replace anything else so the PDF never fails. */
const latin = (s: string) => s.replace(new RegExp('[^\x20-\x7e\xa0-\xff]', 'g'), '?');

function hexColour(hex: string | null | undefined) {
	const h = /^#([0-9a-f]{6})$/i.exec(hex ?? '')?.[1] ?? '0b2545';
	const n = parseInt(h, 16);
	return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export interface TableDoc {
	/** big title, e.g. "Earnings report" */
	title: string;
	/** small line under the title, e.g. the period */
	subtitle?: string;
	/** who it is from (shown top right); with a brand colour it is the tutor's brand */
	from: string;
	brandColour?: string | null;
	/** optional lines before the table (e.g. "To: Tatenda Moyo") */
	lines?: string[];
	sections: {
		heading: string;
		columns: string[];
		/** which columns are right-aligned (amounts) */
		right?: number[];
		rows: string[][];
		total?: string[];
	}[];
	footer?: string;
}

export async function tablePdf(d: TableDoc): Promise<Uint8Array> {
	const doc = await PDFDocument.create();
	doc.setTitle(latin(d.title));
	doc.setProducer('Tutora');
	const font = await doc.embedFont(StandardFonts.Helvetica);
	const bold = await doc.embedFont(StandardFonts.HelveticaBold);
	const serif = await doc.embedFont(StandardFonts.TimesRomanBold);
	const brand = hexColour(d.brandColour);
	const ink = rgb(0.11, 0.15, 0.13);
	const grey = rgb(0.36, 0.4, 0.37);
	const line = rgb(0.88, 0.89, 0.92);
	const W = 595;
	const H = 842;
	const x0 = 48;
	const x1 = W - 48;
	let page: PDFPage = doc.addPage([W, H]);
	let y = H - 64;

	const text = (s: string, x: number, yy: number, size: number, f: PDFFont, c = ink) =>
		page.drawText(latin(s), { x, y: yy, size, font: f, color: c });
	const header = () => {
		page.drawRectangle({ x: 0, y: H - 12, width: W, height: 12, color: brand });
		text(d.from || 'Tutora', x0, H - 52, 20, serif, brand);
		const t = latin(d.title);
		text(t, x1 - bold.widthOfTextAtSize(t, 13), H - 48, 13, bold);
		y = H - 76;
	};
	const newPageIfNeeded = (need: number) => {
		if (y - need > 60) return;
		page = doc.addPage([W, H]);
		header();
	};
	header();
	if (d.subtitle) {
		text(d.subtitle, x0, y, 10, font, grey);
		y -= 18;
	}
	for (const l of d.lines ?? []) {
		text(l, x0, y, 10, font);
		y -= 15;
	}
	y -= 8;
	for (const sec of d.sections) {
		newPageIfNeeded(60);
		text(sec.heading, x0, y, 12, bold, brand);
		y -= 18;
		const n = sec.columns.length;
		const first = n > 1 ? (x1 - x0) * 0.45 : x1 - x0;
		const rest = n > 1 ? (x1 - x0 - first) / (n - 1) : 0;
		const colX = (i: number) => (i === 0 ? x0 : x0 + first + rest * (i - 1));
		const colW = (i: number) => (i === 0 ? first : rest);
		const row = (cells: string[], f: PDFFont, c = ink) => {
			newPageIfNeeded(20);
			cells.forEach((v, i) => {
				let s = latin(v ?? '');
				if (f.widthOfTextAtSize(s, 9.5) > colW(i) - 6) {
					while (s.length > 1 && f.widthOfTextAtSize(s + '...', 9.5) > colW(i) - 6)
						s = s.slice(0, -1);
					s += '...';
				}
				const w = f.widthOfTextAtSize(s, 9.5);
				const x = sec.right?.includes(i) ? colX(i) + colW(i) - w - 4 : colX(i);
				text(s, x, y, 9.5, f, c);
			});
			y -= 6;
			page.drawLine({ start: { x: x0, y }, end: { x: x1, y }, thickness: 0.5, color: line });
			y -= 12;
		};
		row(sec.columns, bold, grey);
		if (!sec.rows.length) row(['—', ...sec.columns.slice(1).map(() => '')], font, grey);
		for (const r of sec.rows) row(r, font);
		if (sec.total) row(sec.total, bold);
		y -= 10;
	}
	if (d.footer) {
		newPageIfNeeded(30);
		text(d.footer, x0, Math.max(y, 50), 8.5, font, grey);
	}
	return doc.save();
}
