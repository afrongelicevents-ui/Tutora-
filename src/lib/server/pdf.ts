import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { ReceiptData } from './billing.ts';
import { formatMoney } from '../money.ts';
import { fmtDate } from '../tz.ts';
import { m } from '../paraglide/messages.js';

const METHOD: Record<ReceiptData['method'], () => string> = {
	bank: m.method_bank,
	ecocash: () => 'EcoCash',
	innbucks: () => 'InnBucks',
	cash: m.method_cash,
	other: m.method_other
};

/** Standard fonts only cover basic Latin; replace anything else so the PDF never fails. */
const latin = (s: string) => s.replace(new RegExp('[^\x20-\x7e\xa0-\xff]', 'g'), '?');

/** A one-page A5 receipt, about 3 KB. */
export async function receiptPdf(r: ReceiptData): Promise<Uint8Array> {
	const doc = await PDFDocument.create();
	doc.setTitle(m.pdf_title({ n: r.number }));
	doc.setProducer('Tutora');
	const page = doc.addPage([420, 595]);
	const font = await doc.embedFont(StandardFonts.Helvetica);
	const bold = await doc.embedFont(StandardFonts.HelveticaBold);
	const serif = await doc.embedFont(StandardFonts.TimesRomanBold);
	const green = rgb(0.043, 0.145, 0.27); // navy (brand)
	const ink = rgb(0.11, 0.15, 0.13);
	const grey = rgb(0.36, 0.4, 0.37);
	const line = rgb(0.9, 0.88, 0.84);
	const x = 36;
	let y = 545;

	page.drawText('tutora', { x, y, size: 26, font: serif, color: green });
	page.drawText(latin(m.pdf_receipt()), { x: 300, y: y + 8, size: 12, font: bold, color: ink });
	page.drawText(r.number, { x: 300, y: y - 8, size: 11, font, color: ink });
	y -= 28;
	const from = [r.tutorName, r.tutorEmail].filter(Boolean).join('  ·  ');
	if (from) page.drawText(latin(from), { x, y, size: 9, font, color: grey });
	y -= 30;

	const row = (label: string, value: string, strong = false) => {
		page.drawText(latin(label), { x, y, size: 10, font, color: grey });
		const f = strong ? bold : font;
		const v = latin(value);
		const w = f.widthOfTextAtSize(v, 10);
		page.drawText(v, {
			x: 384 - Math.min(w, 250),
			y,
			size: 10,
			font: f,
			color: ink,
			maxWidth: 250
		});
		y -= 8;
		page.drawLine({ start: { x, y }, end: { x: 384, y }, thickness: 0.6, color: line });
		y -= 16;
	};
	row(m.pdf_date(), fmtDate(r.date));
	if (r.tutorName) row(m.pdf_tutor(), r.tutorName);
	row(m.pdf_from(), r.studentName);
	row(m.pdf_method(), METHOD[r.method]() + (r.reference ? `  ·  ${r.reference}` : ''));
	if (r.covers.length) {
		page.drawText(latin(m.pdf_for()), { x, y, size: 10, font, color: grey });
		y -= 16;
		for (const c of r.covers.slice(0, 14)) {
			page.drawText(latin(c.description).slice(0, 60), {
				x: x + 10,
				y,
				size: 9.5,
				font,
				color: ink
			});
			const amt = formatMoney(c.amountCents, r.currency);
			page.drawText(amt, {
				x: 384 - font.widthOfTextAtSize(amt, 9.5),
				y,
				size: 9.5,
				font,
				color: ink
			});
			y -= 14;
		}
		y -= 2;
		page.drawLine({ start: { x, y }, end: { x: 384, y }, thickness: 0.6, color: line });
		y -= 16;
	}
	row(m.pdf_amount(), formatMoney(r.amountCents, r.currency), true);
	y -= 6;
	page.drawText(latin(m.pdf_thanks()), { x, y, size: 9, font, color: grey });
	y -= 14;
	page.drawText(latin(m.pdf_recorded()), { x, y, size: 8, font, color: grey, maxWidth: 348 });
	return doc.save();
}
