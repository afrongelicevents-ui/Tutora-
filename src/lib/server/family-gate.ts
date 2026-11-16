/**
 * Tutora Family per child, on the server. A parent's Family pages (progress, reports,
 * personal report, School+, a child's saved reports) open only for the children the plan
 * covers. Called from hooks.server.ts for every request to a Family page, form posts too.
 */
import { eq } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';
import type { DB } from './db/types.ts';
import { partnership } from './db/v3.schema.ts';
import { childrenOf } from './family.ts';
import { familyCoverage } from './family-billing.ts';
import { lockedLocation, type FamilyFeature } from '../family-features.ts';

/** the child a Family page is about: in the address, a School+ partnership, the form or ?child= */
async function childInRequest(event: RequestEvent, path: string): Promise<string | null> {
	const inPath = /^\/parent\/child\/([^/]+)\//.exec(path);
	if (inPath) return decodeURIComponent(inPath[1]);
	const sp = /^\/parent\/school-plus\/(\d+)(\/|$)/.exec(path);
	if (sp) {
		const [p] = await (event.locals.db as DB)
			.select({ s: partnership.studentId })
			.from(partnership)
			.where(eq(partnership.id, Number(sp[1])));
		return p?.s ?? null;
	}
	if (event.request.method === 'POST') {
		const form = await event.request
			.clone()
			.formData()
			.catch(() => null);
		const c = form?.get('child');
		if (typeof c === 'string' && c) return c;
	}
	return event.url.searchParams.get('child');
}

/**
 * null: go on. Otherwise the response that sends the parent elsewhere: the Plans page when
 * no child is covered; the child's own (free) page with "Add this child to Tutora Family"
 * when this child is not covered; or the same page for a covered child when none was chosen.
 */
export async function parentFamilyGate(
	event: RequestEvent,
	feature: FamilyFeature
): Promise<Response | null> {
	const db = event.locals.db as DB;
	const parentId = event.locals.user!.id;
	const cov = await familyCoverage(db, parentId);
	if (cov.all) return null;
	const path = event.url.pathname.replace(/\/__data\.json$/, '');
	const isData = event.isDataRequest || event.url.pathname.endsWith('/__data.json');
	const refuse = (location: string) =>
		isData
			? new Response('Forbidden', { status: 403 })
			: new Response(null, { status: 303, headers: { location } });
	if (!cov.covered.length) return refuse(lockedLocation(path, feature));

	const explicit = await childInRequest(event, path);
	const kids = (await childrenOf(db, parentId)).filter((c) => c.status === 'active');
	const mine = (id: string | null) => !!id && kids.some((k) => k.studentId === id);
	if (explicit) {
		if (cov.covered.includes(explicit)) return null;
		// another family's child: the page itself answers (not found / own child)
		if (!mine(explicit)) return null;
		return refuse(`/parent/child/${encodeURIComponent(explicit)}?locked=${feature}`);
	}
	// no child chosen: the page would pick the last one chosen (cookie), else the first
	const remembered = event.cookies.get('tutora_child') ?? null;
	const current = mine(remembered) ? remembered : (kids[0]?.studentId ?? null);
	if (!current || cov.covered.includes(current)) return null;
	const first = kids.find((k) => cov.covered.includes(k.studentId))?.studentId;
	if (!first) return refuse(lockedLocation(path, feature));
	const to = new URL(event.url);
	to.pathname = path;
	to.searchParams.set('child', first);
	to.searchParams.delete('x-sveltekit-invalidated');
	return refuse(to.pathname + to.search);
}
