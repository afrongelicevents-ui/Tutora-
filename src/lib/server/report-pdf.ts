/**
 * A stored report as a one-page A4 PDF (pdf-lib, standard fonts, a few KB). With Tutora Pro
 * the tutor's name and colour brand the top of the page; otherwise it is plain Tutora.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { ReportFigures } from './db/report.schema.ts';
import { fmtDate, fromLocal } from '../tz.ts';
import { m } from '../paraglide/messages.js';

const latin = (s: string) => s.replace(new RegExp('[^\x20-\x7e\xa0-\xff]', 'g'), '?');

function hex(c: string | null | undefined) {
	const v = /^#([0-9a-f]{6})$/i.exec(c ?? '')?.[1] ?? '0b2545';
	const n = parseInt(v, 16);
	return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export interface ReportPdfData {
	studentName: string;
	tutorName: string;
	periodStart: string;
	periodEnd: string;
	note: string | null;
	figures: ReportFigures;
	sentAt: Date | null;
	/** Tutora Pro branding, or null */
	brand: { name: string; colour: string } | null;
}

/** Split text into lines that fit a width. */
function wrap(
	text: string,
	width: number,
	size: number,
	measure: (s: string, n: number) => number
) {
	const out: string[] = [];
	for (const para of latin(text).split(/\n+/)) {
		let line = '';
		for (const w of para.split(/\s+/)) {
			const next = line ? `${line} ${w}` : w;
			if (measure(next, size) > width && line) {
				out.push(line);
				line = w;
			} else line = next;
		}
		if (line) out.push(line);
	}
	return out;
}

export async function reportPdf(r: ReportPdfData): Promise<Uint8Array> {
	const doc = await PDFDocument.create();
	doc.setTitle(latin(m.rp_pdf_title({ name: r.studentName })));
	doc.setProducer('Tutora');
	const page = doc.addPage([595, 842]);
	const font = await doc.embedFont(StandardFonts.Helvetica);
	const bold = await doc.embedFont(StandardFonts.HelveticaBold);
	const serif = await doc.embedFont(StandardFonts.TimesRomanBold);
	const brand = hex(r.brand?.colour);
	const ink = rgb(0.11, 0.15, 0.13);
	const grey = rgb(0.36, 0.4, 0.37);
	const line = rgb(0.9, 0.88, 0.84);
	const x = 48;
	const right = 547;
	let y = 790;

	page.drawRectangle({ x: 0, y: 812, width: 595, height: 30, color: brand });
	if (r.brand?.name) {
		page.drawText(latin(r.brand.name).slice(0, 50), { x, y, size: 22, font: serif, color: brand });
		y -= 16;
		page.drawText(latin(m.rp_pdf_with_tutora()), { x, y, size: 9, font, color: grey });
	} else page.drawText('tutora', { x, y, size: 26, font: serif, color: brand });
	page.drawText(latin(m.rp_pdf_heading()), { x: 400, y: 790, size: 13, font: bold, color: ink });
	y -= 34;

	const period = `${fmtDate(fromLocal(r.periodStart, 720))} – ${fmtDate(fromLocal(r.periodEnd, 720))}`;
	const kv = (label: string, value: string) => {
		page.drawText(latin(label), { x, y, size: 10, font, color: grey });
		page.drawText(latin(value).slice(0, 70), { x: 170, y, size: 10, font: bold, color: ink });
		y -= 18;
	};
	kv(m.rp_pdf_student(), r.studentName);
	kv(m.rp_pdf_tutor(), r.tutorName);
	kv(m.rp_pdf_period(), period);
	if (r.sentAt) kv(m.rp_pdf_sent(), fmtDate(r.sentAt));
	y -= 6;
	page.drawLine({ start: { x, y }, end: { x: right, y }, thickness: 0.8, color: line });
	y -= 24;

	const h2 = (t: string) => {
		page.drawText(latin(t), { x, y, size: 13, font: bold, color: brand });
		y -= 20;
	};
	const row = (label: string, value: string) => {
		page.drawText(latin(label), { x: x + 6, y, size: 10.5, font, color: ink });
		const v = latin(value);
		page.drawText(v, {
			x: right - bold.widthOfTextAtSize(v, 10.5),
			y,
			size: 10.5,
			font: bold,
			color: ink
		});
		y -= 17;
	};
	const f = r.figures;
	h2(m.rp_lessons());
	row(m.rp_lessons_booked(), String(f.lessons.booked));
	row(m.rp_lessons_attended(), String(f.lessons.attended));
	row(m.rp_lessons_missed(), String(f.lessons.missed));
	y -= 8;
	h2(m.rp_homework());
	row(m.rp_hw_set(), String(f.homework.set));
	row(m.hws_done(), String(f.homework.done));
	row(m.hws_late(), String(f.homework.late));
	row(m.hws_missing(), String(f.homework.missing));
	if (f.homework.waiting) row(m.hws_waiting(), String(f.homework.waiting));
	y -= 8;
	h2(m.rp_checkins());
	row(m.rp_checkin_days(), String(f.checkins.days));
	y -= 8;
	h2(m.rp_tests());
	if (!f.tests.length) {
		page.drawText(latin(m.rp_no_tests()), { x: x + 6, y, size: 10, font, color: grey });
		y -= 17;
	} else {
		if (f.testAvg !== null) row(m.rp_test_avg(), `${f.testAvg}%`);
		for (const t of f.tests.slice(0, 12))
			row(`${t.subject} · ${t.chapter}`.slice(0, 60), `${t.pct}%`);
	}
	y -= 8;
	if (r.note) {
		h2(m.rp_note());
		for (const l of wrap(r.note, right - x - 6, 10.5, (s, n) => font.widthOfTextAtSize(s, n)).slice(
			0,
			22
		)) {
			page.drawText(l, { x: x + 6, y, size: 10.5, font, color: ink });
			y -= 15;
		}
	}
	page.drawText(latin(m.rp_pdf_footer()), {
		x,
		y: 40,
		size: 8,
		font,
		color: grey,
		maxWidth: right - x
	});
	return doc.save();
}
