// Measures real Cloudflare CPU time per route on the TEST site: listens to the worker's
// live log (`wrangler tail`, which reports each request's CPU time), visits every page as
// the fake test accounts, then prints a table. Run by .github/workflows/perf.yml.
//
// Env: SITE (https://tutora-test…), TEST_PASSWORD, CRON_SECRET (optional),
//      CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID (for wrangler), WORKER (tutora-test)
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const SITE = process.env.SITE?.replace(/\/$/, '');
const PW = process.env.TEST_PASSWORD;
const WORKER = process.env.WORKER ?? 'tutora-test';
const RUNS = Number(process.env.RUNS ?? 4);
if (!SITE || !PW) throw new Error('SITE and TEST_PASSWORD are needed');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const statuses = [];

// 1. start listening
const tail = spawn('npx', ['wrangler', 'tail', WORKER, '--format', 'json'], {
	env: process.env,
	stdio: ['ignore', 'pipe', 'pipe']
});
let raw = '';
tail.stdout.on('data', (d) => (raw += d));
tail.stderr.on('data', () => {});
await sleep(12_000);

// 2. visit the pages
async function reqRaw(path, { cookie = '', method = 'GET', body, headers = {} } = {}) {
	const res = await fetch(SITE + path, {
		method,
		body,
		redirect: 'manual',
		// a hanging request must never stop the whole measurement
		signal: AbortSignal.timeout(20_000),
		headers: { cookie, 'user-agent': 'tutora-perf', origin: SITE, ...headers }
	});
	const text = await res.text().catch(() => '');
	return { res, text };
}

async function login(email) {
	// Cloudflare may refuse with 503 when a request goes over the CPU limit: try again
	for (let i = 0; i < 5; i++) {
		const { res } = await req('/login', {
			method: 'POST',
			body: new URLSearchParams({ email, password: PW, remember: 'on' }).toString(),
			headers: { 'content-type': 'application/x-www-form-urlencoded' }
		});
		statuses.push(res.status);
		const cookies = res.headers.getSetCookie().map((c) => c.split(';')[0]);
		if (cookies.length) return cookies.join('; ');
		await sleep(3_000);
	}
	console.log('A test login kept failing; skipping that account.');
	return null;
}

async function req(path, opts) {
	try {
		return await reqRaw(path, opts);
	} catch {
		return { res: new Response(null, { status: 599 }), text: '' };
	}
}

const PUBLIC = [
	'/',
	'/tutors',
	'/t/chipo-moyo',
	'/t/chipo-moyo/reviews',
	'/join',
	'/login',
	'/signup',
	'/terms',
	'/privacy',
	'/contact',
	'/code',
	'/no-access'
];
const ROLES = {
	'nyasha@example.com': [
		'/student',
		'/student/lessons',
		'/student/find',
		'/student/tutors',
		'/student/tutor/chipo-moyo',
		'/student/book?tutor=chipo-moyo',
		'/student/homework',
		'/student/progress',
		'/student/me',
		'/student/me/edit',
		'/student/planner',
		'/student/report',
		'/student/schedule',
		'/student/days',
		'/student/study',
		'/student/subjects',
		'/student/messages',
		'/student/messages/test_chipo',
		'/student/payments',
		'/student/tools',
		'/student/family',
		'/student/buddies',
		'/student/check',
		'/notifications',
		'/account'
	],
	'sibanda@example.com': [
		'/parent',
		'/parent?child=test_tatenda',
		'/parent/children',
		'/parent/updates',
		'/parent/report',
		'/parent/personal',
		'/parent/messages',
		'/parent/buddies',
		'/parent/school-plus',
		'/parent/book?tutor=chipo-moyo&child=test_tatenda'
	],
	'chipo@example.com': [
		'/tutor',
		'/tutor/calendar',
		'/tutor/calendar?view=month',
		'/tutor/students',
		'/tutor/students/test_nyasha',
		'/tutor/homework',
		'/tutor/payments',
		'/tutor/messages',
		'/tutor/messages/test_nyasha',
		'/tutor/more',
		'/tutor/day',
		'/tutor/reviews',
		'/tutor/resources',
		'/tutor/assessments',
		'/tutor/tools',
		'/tutor/settings',
		'/tutor/school-plus'
	],
	'owner@example.com': [
		'/owner',
		'/owner/students',
		'/owner/bookings',
		'/owner/payments',
		'/owner/reports',
		'/owner/moderation',
		'/owner/content',
		'/owner/audit',
		'/owner/account',
		'/owner/limits'
	]
};

const visited = [];
for (const p of PUBLIC) for (let i = 0; i < RUNS; i++) visited.push((await req(p)).res.status);
for (const [who, paths] of Object.entries(ROLES)) {
	const cookie = await login(who);
	if (!cookie) continue;
	const list = [...paths];
	if (who.startsWith('chipo')) {
		// a real lesson page, found on the calendar
		const { text } = await req('/tutor/calendar?view=all', { cookie });
		const id = /\/tutor\/lessons\/(\d+)/.exec(text)?.[1];
		if (id) list.push(`/tutor/lessons/${id}`);
	}
	for (const p of list)
		for (let i = 0; i < RUNS; i++) visited.push((await req(p, { cookie })).res.status);
}
// database driver comparison (test site only): the same queries three ways
for (const d of ['ws', 'http', 'batch'])
	for (let i = 0; i < RUNS * 2; i++)
		visited.push((await req(`/api/perf-probe?driver=${d}`)).res.status);
// the hourly job, when its secret is known
if (process.env.CRON_SECRET)
	await req('/api/cron/reminders', {
		method: 'POST',
		headers: { authorization: `Bearer ${process.env.CRON_SECRET}` }
	});

// 3. collect what the worker reported
await sleep(20_000);
tail.kill('SIGINT');
await sleep(2_000);

const events = [];
for (const chunk of raw.split(/\n(?=\{)/)) {
	try {
		events.push(JSON.parse(chunk));
	} catch {
		/* a partial line */
	}
}
const norm = (u) => {
	const x = new URL(u);
	return (
		x.pathname.replace(/\/\d+(?=\/|$)/g, '/[id]') +
		(x.search
			? x.pathname.startsWith('/api/perf-probe')
				? x.search
				: x.search.replace(/=[^&]*/g, '=…')
			: '')
	).replace(/\/__data\.json$/, ' (data)');
};
const by = new Map();
const outcomes = {};
let withCpu = 0;
for (const e of events) {
	const r = e.event?.request;
	if (!r?.url) continue;
	outcomes[e.outcome] = (outcomes[e.outcome] ?? 0) + 1;
	const cpu = e.cpuTime ?? e.cpu_time ?? null;
	if (cpu == null) continue;
	withCpu++;
	const key = `${r.method} ${norm(r.url)}`;
	if (!by.has(key)) by.set(key, []);
	by.get(key).push(cpu);
}
const q = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];
const rows = [...by.entries()]
	.map(([k, a]) => {
		a.sort((x, y) => x - y);
		return { route: k, n: a.length, p50: q(a, 0.5), p90: q(a, 0.9), max: a.at(-1) };
	})
	.sort((a, b) => b.p50 - a.p50);
const all = rows.flatMap((r) => by.get(r.route)).sort((x, y) => x - y);
const summary = {
	requestsSent: visited.length,
	errorsSeenByVisitor: [...visited, ...statuses].filter((x) => x >= 500).length,
	eventsSeen: events.length,
	eventsWithCpu: withCpu,
	outcomes,
	overall: all.length ? { p50: q(all, 0.5), p90: q(all, 0.9), max: all.at(-1) } : null,
	over10ms: rows.filter((r) => r.p50 >= 10).length,
	routes: rows
};
fs.writeFileSync('perf-remote.json', JSON.stringify(summary, null, 1));
console.log(
	`requests ${visited.length}, log events ${events.length}, with CPU ${withCpu}, 5xx seen ${summary.errorsSeenByVisitor}`
);
console.log('outcomes', JSON.stringify(outcomes));
if (summary.overall)
	console.log(
		`all requests: p50 ${summary.overall.p50} ms, p90 ${summary.overall.p90} ms, max ${summary.overall.max} ms`
	);
console.log('\n| route | n | CPU p50 ms | p90 | max |\n|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.route} | ${r.n} | ${r.p50} | ${r.p90} | ${r.max} |`);
if (!withCpu && events.length)
	console.log('\nThe log events carry no CPU time. Keys seen:', Object.keys(events[0]).join(', '));
process.exit(0);
