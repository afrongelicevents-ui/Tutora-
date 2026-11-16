import type { PageServerLoad } from './$types';
import { proLoad } from '#lib/server/pro-pages.ts';

/** Tutora Pro invoices: due, proof sent, paid, overdue; receipts. */
export const load: PageServerLoad = (event) => proLoad(event);
