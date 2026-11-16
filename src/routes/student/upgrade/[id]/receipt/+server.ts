import type { RequestHandler } from './$types';
import { familyReceipt } from '#lib/server/family-pages.ts';

/** An adult student's own Tutora receipt. */
export const GET: RequestHandler = (event) =>
	familyReceipt(event, ['student'], Number(event.params.id) || 0);
