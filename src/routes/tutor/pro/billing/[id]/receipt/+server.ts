import type { RequestHandler } from './$types';
import { proReceipt } from '#lib/server/pro-pages.ts';

/** The Tutora receipt for one of the tutor's own paid Tutora Pro invoices. */
export const GET: RequestHandler = (event) => proReceipt(event, Number(event.params.id) || 0);
