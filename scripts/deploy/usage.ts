// Hourly: how much of the free limits Tutora uses (Cloudflare Workers + Neon), saved for
// Owner → Free limits. Alerts the owner(s) in the app (and by email once email is set up)
// at 70% of any limit, or as soon as Cloudflare refuses requests for going over a limit.
// Runs in GitHub Actions, never on the website, so it costs the site nothing.
// Env: DATABASE_URL, SITE (live|test), WORKER, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID,
//      NEON_API_KEY, NEON_PROJECT_ID, optional RESEND_API_KEY / EMAIL_FROM.
// Logs are public: only counts are printed.
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';
import pg from 'pg';
import type { DB } from '../../src/lib/server/db/types.ts';
import { user } from '../../src/lib/server/db/auth.schema.ts';
import { usageAlert, usageSnapshot } from '../../src/lib/server/db/usage.schema.ts';
import { saveNotification } from '../../src/lib/server/notify-core.ts';
import { createSendEmail } from '../../src/lib/server/email.ts';
import { needsAlert, type Usage } from '../../src/lib/server/free-limits.ts';
import { aiStopLine } from '../../src/lib/server/ai-tests.ts';
import { m } from '../../src/lib/paraglide/messages.js';

const SITE = process.env.SITE === 'test' ? 'test' : 'live';
const WORKER = process.env.WORKER ?? (SITE === 'test' ? 'tutora-test' : 'tutora');
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN?.trim();
const CF_ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
const NEON_KEY = process.env.NEON_API_KEY?.trim();
const NEON_PROJECT = process.env.NEON_PROJECT_ID?.trim();

async function cloudflare(now: Date): Promise<Usage['cloudflare']> {
	if (!CF_TOKEN || !CF_ACCOUNT) return { ok: false, reason: 'no_token' };
	const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
	const query = `query($a: String!, $s: Time!, $e: Time!, $w: String!) { viewer { accounts(filter: { accountTag: $a }) {
		workersInvocationsAdaptive(limit: 100, filter: { datetime_geq: $s, datetime_leq: $e, scriptName: $w }) {
			sum { requests errors } quantiles { cpuTimeP50 cpuTimeP99 } dimensions { status } } } } }`;
	const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
		method: 'POST',
		headers: { authorization: `Bearer ${CF_TOKEN}`, 'content-type': 'application/json' },
		body: JSON.stringify({
			query,
			variables: { a: CF_ACCOUNT, s: start.toISOString(), e: now.toISOString(), w: WORKER }
		})
	});
	const body = (await res.json().catch(() => ({}))) as {
		errors?: { message: string }[];
		data?: {
			viewer: {
				accounts: {
					workersInvocationsAdaptive: {
						sum: { requests: number; errors: number };
						quantiles: { cpuTimeP50: number; cpuTimeP99: number };
						dimensions: { status: string };
					}[];
				}[];
			};
		};
	};
	if (!res.ok || body.errors?.length) {
		const msg = body.errors?.[0]?.message ?? String(res.status);
		return { ok: false, reason: /auth|permission|access/i.test(msg) ? 'no_permission' : 'failed' };
	}
	const rows = body.data?.viewer.accounts[0]?.workersInvocationsAdaptive ?? [];
	let requests = 0;
	let errors = 0;
	let limitErrors = 0;
	let p50 = 0;
	let p99 = 0;
	for (const r of rows) {
		requests += r.sum.requests;
		errors += r.sum.errors;
		if (/exceeded/i.test(r.dimensions.status)) limitErrors += r.sum.requests;
		// weighted by requests for p50; the highest for p99
		p50 += (r.quantiles.cpuTimeP50 / 1000) * r.sum.requests;
		p99 = Math.max(p99, r.quantiles.cpuTimeP99 / 1000);
	}
	return {
		ok: true,
		requestsToday: requests,
		errorsToday: errors,
		limitErrorsToday: limitErrors,
		cpuP50Ms: requests ? +(p50 / requests).toFixed(2) : null,
		cpuP99Ms: requests ? +p99.toFixed(2) : null
	};
}

async function neon(): Promise<Usage['neon']> {
	if (!NEON_KEY || !NEON_PROJECT) return { ok: false, reason: 'no_token' };
	const res = await fetch(`https://console.neon.tech/api/v2/projects/${NEON_PROJECT}`, {
		headers: { authorization: `Bearer ${NEON_KEY}`, accept: 'application/json' }
	});
	if (!res.ok) return { ok: false, reason: res.status === 403 ? 'no_permission' : 'failed' };
	const { project: p } = (await res.json()) as {
		project: {
			compute_time_seconds?: number;
			synthetic_storage_size?: number;
			data_transfer_bytes?: number;
		};
	};
	return {
		ok: true,
		computeHoursMonth: +((p.compute_time_seconds ?? 0) / 3600).toFixed(2),
		storageMb: +((p.synthetic_storage_size ?? 0) / 1048576).toFixed(1),
		egressMbMonth:
			p.data_transfer_bytes != null ? +(p.data_transfer_bytes / 1048576).toFixed(1) : null
	};
}

async function main() {
	const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
	const db = drizzle(pool) as unknown as DB;
	try {
		const now = new Date();
		const [cf, nn, size] = await Promise.all([
			cloudflare(now).catch(() => ({ ok: false as const, reason: 'failed' })),
			neon().catch(() => ({ ok: false as const, reason: 'failed' })),
			db.execute(sql`select pg_database_size(current_database())::bigint as b`)
		]);
		const sizeRows = (size as unknown as { rows?: { b: string }[] }).rows ?? [];
		// the latest per-route CPU measurement (Measure CPU workflow), if one was saved
		const prev = await db
			.select({ data: usageSnapshot.data })
			.from(usageSnapshot)
			.where(eq(usageSnapshot.site, SITE))
			.orderBy(sql`${usageSnapshot.takenAt} desc`)
			.limit(1);
		// the AI test maker's own counter for today (UTC), on this site's database
		const ai = await db
			.execute(
				sql`select coalesce(sum(neurons), 0)::int as n from ai_usage where day = ${now.toISOString().slice(0, 10)}`
			)
			.then((r) => Number((r as unknown as { rows?: { n: number }[] }).rows?.[0]?.n ?? 0))
			.catch(() => null);
		const usage: Usage = {
			at: now.toISOString(),
			...(ai === null ? {} : { ai: { neuronsToday: ai, stopAt: aiStopLine(SITE === 'test') } }),
			cloudflare: cf,
			neon: nn,
			dbSizeMb: +(Number(sizeRows[0]?.b ?? 0) / 1048576).toFixed(1),
			slowest:
				(process.env.SLOWEST ? JSON.parse(process.env.SLOWEST) : null) ??
				(prev[0]?.data as Usage | undefined)?.slowest ??
				null
		};
		await db.insert(usageSnapshot).values({ site: SITE, data: usage });
		// keep two weeks of hourly snapshots
		await db.execute(sql`delete from usage_snapshot where taken_at < now() - interval '14 days'`);

		// alerts: once per limit per day, to every owner
		const day = now.toISOString().slice(0, 10);
		const owners = await db.select({ id: user.id }).from(user).where(eq(user.role, 'owner'));
		const key = process.env.RESEND_API_KEY?.trim();
		const send = key
			? createSendEmail({ apiKey: key, from: process.env.EMAIL_FROM, production: true })
			: null;
		let alerts = 0;
		for (const a of needsAlert(usage)) {
			const claimed = await db
				.insert(usageAlert)
				.values({ key: `${SITE}:${day}:${a.key}:${a.level}`, level: a.level === 'over' ? 2 : 1 })
				.onConflictDoNothing()
				.returning({ key: usageAlert.key });
			if (!claimed.length) continue;
			alerts++;
			const what = m[`fl_name_${a.key}` as 'fl_name_requests']();
			const subject =
				a.key === 'limitErrors'
					? m.fl_alert_errors_s({ site: SITE })
					: m.fl_alert_s({ what, pct: Math.round(a.share * 100), site: SITE });
			const body =
				a.key === 'limitErrors' ? m.fl_alert_errors_b({ n: a.used }) : m.fl_alert_b({ what });
			for (const o of owners) {
				const r = await saveNotification(db, o.id, subject, body, {
					kind: 'account',
					link: '/owner/limits'
				});
				if (send && r?.sendEmail)
					await send({ to: r.email, subject, text: `${body}\n\n${m.email_sign()}` }).catch(
						() => {}
					);
			}
		}
		await db.execute(sql`delete from usage_alert where sent_at < now() - interval '30 days'`);
		console.log(
			`Usage (${SITE}): cloudflare ${cf.ok ? 'read' : cf.reason}, neon ${nn.ok ? 'read' : nn.reason}, alerts sent ${alerts}.`
		);
	} finally {
		await pool.end();
	}
}

main().catch((e) => {
	console.log(`::error::Usage check failed (${e?.cause?.code ?? e?.name ?? 'error'}).`);
	process.exit(1);
});
