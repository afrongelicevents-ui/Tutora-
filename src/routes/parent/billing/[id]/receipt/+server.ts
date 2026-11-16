import type { RequestHandler } from './$types';
import { familyReceipt } from '#lib/server/family-pages.ts';

/** The Tutora receipt for one of the parent's own paid Tutora Family invoices. */
export const GET: RequestHandler = (event) =>
	familyReceipt(event, ['parent'], Number(event.params.id) || 0);
