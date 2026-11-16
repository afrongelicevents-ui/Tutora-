/**
 * The free plans Tutora runs on, and how close we are to each limit.
 * Sources (checked 15 Nov 2026): developers.cloudflare.com/workers/platform/limits and
 * neon.com/docs (free plan). See docs/FREE-LIMITS.md for what happens when one is reached.
 */
export const LIMITS = {
	/** Cloudflare Workers Free: requests per day (resets 00:00 UTC) */
	requestsPerDay: 100_000,
	/** Cloudflare Workers Free: CPU time per request, in milliseconds */
	cpuMsPerRequest: 10,
	/** Cloudflare Workers Logs Free: log events per day */
	logEventsPerDay: 200_000,
	/** Neon Free: compute (CU-hours) per month, shared by the live and test databases */
	computeHoursPerMonth: 100,
	/** Neon Free: storage (Neon's own pages say 0.5 or 1 GB: we plan for the lower one) */
	storageMb: 512,
	/** Neon Free: data sent out of the database per month */
	egressMbPerMonth: 5 * 1024,
	/** Cloudflare Workers AI Free: neurons per day per account (resets 00:00 UTC) */
	aiNeuronsPerDay: 10_000
} as const;

export const WARN_AT = 0.7;

export interface Usage {
	at: string;
	cloudflare:
		| {
				ok: true;
				requestsToday: number;
				errorsToday: number;
				/** requests refused for going over a limit (CPU, memory): "exceeded resources" */
				limitErrorsToday: number;
				cpuP50Ms: number | null;
				cpuP99Ms: number | null;
		  }
		| { ok: false; reason: string };
	neon:
		| {
				ok: true;
				computeHoursMonth: number;
				storageMb: number;
				egressMbMonth: number | null;
		  }
		| { ok: false; reason: string };
	/** the database's own size, measured directly (always available) */
	dbSizeMb: number;
	/** heaviest routes from the last measurement, when known */
	slowest: { route: string; p50: number; p90: number }[] | null;
	/**
	 * The AI test maker today (our own counter on this site's database) and where this site
	 * stops it (the two sites' lines together are 80% of the free allowance).
	 */
	ai?: { neuronsToday: number; stopAt: number };
}

export interface Meter {
	key: 'requests' | 'cpu' | 'limitErrors' | 'compute' | 'storage' | 'egress' | 'ai';
	used: number;
	limit: number;
	/** 0–1 (more than 1 when over) */
	share: number;
	level: 'ok' | 'warn' | 'over';
}

const meter = (key: Meter['key'], used: number, limit: number): Meter => {
	const share = limit > 0 ? used / limit : 0;
	return { key, used, limit, share, level: share >= 1 ? 'over' : share >= WARN_AT ? 'warn' : 'ok' };
};

/** Every limit with how much of it is used. Missing data is simply left out. */
export function meters(u: Usage): Meter[] {
	const out: Meter[] = [];
	if (u.cloudflare.ok) {
		out.push(meter('requests', u.cloudflare.requestsToday, LIMITS.requestsPerDay));
		if (u.cloudflare.cpuP99Ms != null)
			out.push(meter('cpu', u.cloudflare.cpuP99Ms, LIMITS.cpuMsPerRequest));
		// any request refused for a limit is already "over": there is no free allowance for it
		const e = u.cloudflare.limitErrorsToday;
		out.push({ key: 'limitErrors', used: e, limit: 0, share: e ? 1 : 0, level: e ? 'over' : 'ok' });
	}
	if (u.neon.ok) {
		out.push(meter('compute', u.neon.computeHoursMonth, LIMITS.computeHoursPerMonth));
		out.push(meter('storage', Math.max(u.neon.storageMb, u.dbSizeMb), LIMITS.storageMb));
		if (u.neon.egressMbMonth != null)
			out.push(meter('egress', u.neon.egressMbMonth, LIMITS.egressMbPerMonth));
	} else out.push(meter('storage', u.dbSizeMb, LIMITS.storageMb));
	// against this site's stop line: at 100% the AI test maker rests until 00:00 UTC
	if (u.ai) out.push(meter('ai', u.ai.neuronsToday, u.ai.stopAt));
	return out;
}

/** The limits worth an alert now (70% or more, or any limit error). */
export const needsAlert = (u: Usage) => meters(u).filter((m) => m.level !== 'ok');
