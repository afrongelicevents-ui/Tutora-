import type { PageServerLoad } from './$types';
import { familyLoad } from '#lib/server/family-pages.ts';

/** Tutora Family invoices: due, proof sent, paid, overdue; receipts. */
export const load: PageServerLoad = async (event) => ({
	...(await familyLoad(event, ['parent'])),
	sent: event.url.searchParams.has('sent')
});
