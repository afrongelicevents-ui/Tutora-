// Serves the PRODUCTION build locally (with the service worker), the way Cloudflare does:
// static files from .svelte-kit/cloudflare, everything else through the built server, on a
// local Postgres through scripts/perf/wsproxy.mjs. Used by scripts/pwa-check.mjs.
//
//   pnpm build
//   node scripts/perf/wsproxy.mjs &
//   PREVIEW_DB=postgres://tutora:tutora@db.local:5432/tutora_e2e node scripts/pwa-preview.mjs
//   (http://127.0.0.1:4173)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { neonConfig } from '@neondatabase/serverless';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const STATIC = path.join(ROOT, '.svelte-kit/cloudflare');
const PORT = Number(process.env.PORT ?? 4173);
const ORIGIN = `http://127.0.0.1:${PORT}`;

neonConfig.wsProxy = () => '127.0.0.1:8099/v1';
neonConfig.fetchEndpoint = () => 'http://127.0.0.1:8099/sql';
neonConfig.useSecureWebSocket = false;
neonConfig.pipelineTLS = false;
neonConfig.pipelineConnect = 'password';

const env = {
	...process.env,
	DATABASE_URL: process.env.PREVIEW_DB ?? 'postgres://tutora:tutora@db.local:5432/tutora_e2e',
	ORIGIN,
	BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? 'ci-only-secret-ci-only-secret-0123456789',
	TEST_SITE: '1'
};
const { server } = await import(path.join(ROOT, '.svelte-kit/cloudflare-tmp/server.js'));
await server.init({ env, read: async () => new Response('').body });
const platform = { env, ctx: { waitUntil() {} }, context: { waitUntil() {} } };

const TYPES = {
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.png': 'image/png',
	'.webp': 'image/webp',
	'.svg': 'image/svg+xml',
	'.woff2': 'font/woff2',
	'.html': 'text/html; charset=utf-8',
	'.webmanifest': 'application/manifest+json',
	'.txt': 'text/plain'
};

http
	.createServer(async (req, res) => {
		const url = new URL(req.url, ORIGIN);
		// like Cloudflare: /offline serves offline.html
		const name = url.pathname === '/offline' ? '/offline.html' : url.pathname;
		const file = path.join(STATIC, decodeURIComponent(name));
		if (
			req.method === 'GET' &&
			file.startsWith(STATIC) &&
			fs.existsSync(file) &&
			fs.statSync(file).isFile() &&
			!url.pathname.startsWith('/_worker')
		) {
			res.writeHead(200, {
				'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream'
			});
			fs.createReadStream(file).pipe(res);
			return;
		}
		let body;
		if (req.method !== 'GET' && req.method !== 'HEAD') {
			const chunks = [];
			for await (const c of req) chunks.push(c);
			body = Buffer.concat(chunks);
		}
		const headers = new Headers();
		for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
		const r = await server.respond(new Request(url, { method: req.method, headers, body }), {
			getClientAddress: () => '127.0.0.1',
			platform
		});
		const out = {};
		r.headers.forEach((v, k) => {
			if (k !== 'set-cookie') out[k] = v;
		});
		const cookies = r.headers.getSetCookie();
		if (cookies.length) out['set-cookie'] = cookies;
		res.writeHead(r.status, out);
		res.end(Buffer.from(await r.arrayBuffer()));
	})
	.listen(PORT, '127.0.0.1', () => console.log(`production preview on ${ORIGIN}`));
