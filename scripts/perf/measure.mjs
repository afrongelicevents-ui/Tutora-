// Measures the CPU time (and database queries) of each page and API route, using the real
// production build and the same Neon driver as on Cloudflare, against a local Postgres
// filled with the test seed. CPU here is Node on this machine: close to, not the same as,
// a Cloudflare Worker. Use it to compare before/after and to find the heavy routes.
//
//   pnpm build
//   node scripts/perf/wsproxy.mjs &              # local stand-in for Neon's WebSocket proxy
//   PERF_DB=postgres://tutora:tutora@db.local:5432/tutora_shot PERF_PASSWORD=… \
//     node scripts/perf/measure.mjs [out.json]
import { neonConfig } from '@neondatabase/serverless';
import pg from 'pg';
import fs from 'node:fs';

const DB = process.env.PERF_DB ?? 'postgres://tutora:tutora@db.local:5432/tutora_shot';
const PASSWORD = process.env.PERF_PASSWORD ?? 'Shot-pass-123';
const RUNS = Number(process.env.PERF_RUNS ?? 15);
const ORIGIN = 'http://localhost:5173';

// the driver talks WebSocket to our local proxy instead of Neon's
neonConfig.wsProxy = () => '127.0.0.1:8099/v1';
neonConfig.fetchEndpoint = () => 'http://127.0.0.1:8099/sql';
neonConfig.useSecureWebSocket = false;
neonConfig.pipelineTLS = false;
neonConfig.pipelineConnect = 'password';

const env = {
	...process.env,
	DATABASE_URL: DB,
	ORIGIN,
	BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? 'perf-only-secret-perf-only-secret-0123',
	TEST_SITE: '1',
	CRON_SECRET: process.env.CRON_SECRET ?? 'perf-only-cron-secret-0123456789'
};
const { server } = await import(
	new URL('../../.svelte-kit/cloudflare-tmp/server.js', import.meta.url)
);
await server.init({ env, read: async () => new Response('').body });

const platform = { env, ctx: { waitUntil() {} }, context: { waitUntil() {} } };
const queries = async () => (await (await fetch('http://127.0.0.1:8099/count')).json()).queries;

async function call(path, { cookie = '', method = 'GET', body, headers = {} } = {}) {
	const req = new Request(ORIGIN + path, {
		method,
		body,
		redirect: 'manual',
		headers: { origin: ORIGIN, cookie, 'user-agent': 'perf', ...headers }
	});
	const res = await server.respond(req, { getClientAddress: () => '127.0.0.1', platform });
	await res.arrayBuffer();
	return res;
}

async function measure(path, opts) {
	const samples = [];
	let status = 0;
	let q = 0;
	for (let i = 0; i < RUNS + 3; i++) {
		const q0 = await queries();
		const c0 = process.cpuUsage();
		const res = await call(path, opts);
		const c = process.cpuUsage(c0);
		const q1 = await queries();
		status = res.status;
		if (i >= 3) {
			samples.push((c.user + c.system) / 1000);
			q = q1 - q0;
		}
	}
	samples.sort((a, b) => a - b);
	return {
		status,
		median: +samples[Math.floor(samples.length / 2)].toFixed(1),
		p90: +samples[Math.floor(samples.length * 0.9)].toFixed(1),
		queries: q
	};
}

async function clearLimits() {
	const c = new pg.Client({ connectionString: DB.replace('db.local', '127.0.0.1') });
	await c.connect();
	await c.query(`delete from action_limit where key like 'login%'`);
	await c.query(`delete from rate_limit`);
	await c.end();
}

async function login(email) {
	await clearLimits();
	// the real login form (a form action), as a person submits it
	const res = await call('/login', {
		method: 'POST',
		body: new URLSearchParams({ email, password: PASSWORD, remember: 'on' }).toString(),
		headers: { 'content-type': 'application/x-www-form-urlencoded' }
	});
	const cookies = res.headers.getSetCookie().map((c) => c.split(';')[0]);
	if (!cookies.length) throw new Error(`login failed for ${email}: ${res.status}`);
	return cookies.join('; ');
}

// ids from the seeded data
const db = new pg.Client({ connectionString: DB.replace('db.local', '127.0.0.1') });
await db.connect();
const one = async (q) => (await db.query(q)).rows[0] ?? {};
const lesson = await one(
	`select l.id from lesson l join attendee a on a.lesson_id = l.id where l.tutor_id = 'test_chipo' and a.user_id = 'test_nyasha' order by l.starts_at desc limit 1`
);
const pay = await one(
	`select id from payment where user_id = 'test_nyasha' and status = 'confirmed' limit 1`
);
const qs = await one(
	`select id from quiz_assignment where student_id = 'test_nyasha' limit 1`
).catch(() => ({}));
const assess = await one(`select id from question_set where tutor_id = 'test_chipo' limit 1`).catch(
	() => ({})
);
const kid = 'test_tatenda';
await db.end();

const ROUTES = {
	public: [
		'/',
		'/tutors',
		'/t/chipo-moyo',
		'/t/chipo-moyo/reviews',
		'/t/chipo-moyo/subjects',
		'/t/chipo-moyo/about',
		'/join',
		'/login',
		'/signup',
		'/get-started',
		'/terms',
		'/privacy',
		'/contact',
		'/code',
		'/forgot-password',
		'/no-access'
	],
	'nyasha@example.com': [
		'/student',
		'/student/lessons',
		`/student/lessons/${lesson.id}`,
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
		...(qs.id ? [`/student/quiz/${qs.id}`] : []),
		'/notifications',
		'/account',
		...(pay.id ? [`/student/payments/${pay.id}/receipt`] : []),
		'/account/export'
	],
	'sibanda@example.com': [
		'/parent',
		`/parent?child=${kid}`,
		'/parent/children',
		'/parent/updates',
		'/parent/report',
		'/parent/personal',
		'/parent/payments',
		'/parent/messages',
		'/parent/buddies',
		'/parent/school-plus',
		`/parent/book?tutor=chipo-moyo&child=${kid}`
	],
	'chipo@example.com': [
		'/tutor',
		'/tutor/calendar',
		'/tutor/calendar?view=month',
		`/tutor/lessons/${lesson.id}`,
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
		...(assess.id ? [`/tutor/assessments/${assess.id}`] : []),
		'/tutor/tools',
		'/tutor/settings',
		'/tutor/school-plus',
		'/tutor/payments/export',
		`/lessons/${lesson.id}/ics`
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
		'/owner/account'
	]
};

// PERF_ONLY=/student PERF_WHO=nyasha@example.com: just call one page many times (for --cpu-prof)
if (process.env.PERF_ONLY) {
	const cookie = process.env.PERF_WHO ? await login(process.env.PERF_WHO) : '';
	if (process.env.PERF_SQL) {
		await call(process.env.PERF_ONLY, { cookie });
		await fetch('http://127.0.0.1:8099/log');
		await call(process.env.PERF_ONLY, { cookie });
		const sqls = await (await fetch('http://127.0.0.1:8099/log')).json();
		sqls.forEach((q, i) =>
			console.log(String(i + 1).padStart(3), q.replace(/\s+/g, ' ').slice(0, 230))
		);
		process.exit(0);
	}
	for (let i = 0; i < Number(process.env.PERF_LOOPS ?? 60); i++)
		await call(process.env.PERF_ONLY, { cookie });
	process.exit(0);
}

// PERF_SET='nyasha@example.com=/student,/student/__data.json;chipo@example.com=/tutor': a subset
if (process.env.PERF_SET) {
	for (const k of Object.keys(ROUTES)) delete ROUTES[k];
	for (const part of process.env.PERF_SET.split(';')) {
		const [who, paths] = part.split('=');
		ROUTES[who] = paths.split(',');
	}
}

const out = [];
for (const [who, paths] of Object.entries(ROUTES)) {
	const cookie = who === 'public' ? '' : await login(who);
	for (const p of paths) {
		const r = await measure(p, { cookie });
		out.push({ who: who === 'public' ? 'public' : who.split('@')[0], path: p, ...r });
		console.log(
			`${String(r.median).padStart(6)} ms  p90 ${String(r.p90).padStart(6)}  q ${String(r.queries).padStart(3)}  ${r.status}  ${p}`
		);
	}
}
if (process.env.PERF_SET) process.exit(0);
// logging in (password check) and the hourly cron job
const loginCpu = [];
for (let i = 0; i < 5; i++) {
	const c0 = process.cpuUsage();
	await login('nyasha@example.com');
	const c = process.cpuUsage(c0);
	loginCpu.push((c.user + c.system) / 1000);
}
loginCpu.sort((a, b) => a - b);
out.push({
	who: 'public',
	path: 'POST /login',
	status: 200,
	median: +loginCpu[2].toFixed(1),
	p90: +loginCpu[4].toFixed(1),
	queries: null
});
console.log(`login median ${loginCpu[2].toFixed(1)} ms`);
{
	const c0 = process.cpuUsage();
	const q0 = await queries();
	const res = await call('/api/cron/reminders', {
		method: 'POST',
		headers: { authorization: `Bearer ${env.CRON_SECRET}` }
	});
	const c = process.cpuUsage(c0);
	const ms = +((c.user + c.system) / 1000).toFixed(1);
	out.push({
		who: 'cron',
		path: 'POST /api/cron/reminders',
		status: res.status,
		median: ms,
		p90: ms,
		queries: (await queries()) - q0
	});
	console.log(`cron ${ms} ms ${res.status}`);
}
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
process.exit(0);
