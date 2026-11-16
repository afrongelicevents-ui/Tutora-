/** A stored report as a PDF download (shared by the tutor's and the family's links). */
import type { DB } from './db/types.ts';
import { user } from './db/auth.schema.ts';
import { eq } from 'drizzle-orm';
import type { studentReport } from './db/report.schema.ts';
import { reportPdf } from './report-pdf.ts';
import { tutorBrand } from './pro.ts';
import { tutorNameOf } from './events.ts';

export async function reportResponse(db: DB, r: typeof studentReport.$inferSelect) {
	const [[s], tutorName, brand] = await Promise.all([
		db.select({ name: user.name }).from(user).where(eq(user.id, r.studentId)),
		tutorNameOf(db, r.tutorId),
		tutorBrand(db, r.tutorId).catch(() => null)
	]);
	const pdf = await reportPdf({
		studentName: s?.name ?? '',
		tutorName,
		periodStart: r.periodStart,
		periodEnd: r.periodEnd,
		note: r.note,
		figures: r.figures,
		sentAt: r.sentAt,
		brand: brand ? { name: brand.name || tutorName, colour: brand.colour } : null
	});
	return new Response(pdf as BodyInit, {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `attachment; filename="tutora-report-${r.periodStart}.pdf"`,
			'cache-control': 'private, no-store'
		}
	});
}
