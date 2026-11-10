import { db } from './db/index.ts';
import { getSettings, type SiteSettings } from './settings.ts';

let cache: { at: number; value: SiteSettings } | null = null;
const TTL_MS = 60_000;

const DEFAULTS: SiteSettings = {
	id: 1,
	tutorName: 'Your tutor',
	whatsappNumber: '+263774231904',
	currency: 'USD',
	showPrices: false,
	updatedAt: new Date(0)
};

/**
 * Site settings with a short in-memory cache (per Cloudflare isolate) to save database reads.
 * If the database is briefly unreachable, public pages still load with the last known
 * (or default) settings instead of an error page.
 */
export async function siteSettings(): Promise<SiteSettings> {
	if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
	try {
		const value = await getSettings(db);
		cache = { at: Date.now(), value };
		return value;
	} catch (e) {
		console.error('siteSettings: database unavailable, using fallback', e);
		return cache?.value ?? DEFAULTS;
	}
}

export function invalidateSiteSettings() {
	cache = null;
}
