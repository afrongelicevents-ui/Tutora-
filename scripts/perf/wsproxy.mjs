// A tiny local stand-in for Neon's WebSocket proxy, so the production build can talk to a
// local Postgres with the same driver it uses on Cloudflare. It also counts the queries
// (Postgres Parse/Query messages) so `measure.mjs` can report queries per page.
//
//   node scripts/perf/wsproxy.mjs   (listens on 127.0.0.1:8099; GET /count -> {"queries":N})
import net from 'node:net';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// `ws` is a dependency of a dependency; resolve it through the pnpm store
const wsPath = require
	.resolve('@neondatabase/serverless')
	.replace(/@neondatabase\+serverless.*$/, '');
let WebSocketServer;
try {
	({ WebSocketServer } = require('ws'));
} catch {
	const fs = await import('node:fs');
	const dir = fs.readdirSync(wsPath).find((d) => d.startsWith('ws@'));
	({ WebSocketServer } = require(`${wsPath}${dir}/node_modules/ws`));
}

const PG = { host: '127.0.0.1', port: 5432 };
let queries = 0;
let log = [];

const server = http.createServer((req, res) => {
	if (req.url === '/log') {
		res.setHeader('content-type', 'application/json');
		res.end(JSON.stringify(log));
		log = [];
	} else if (req.url === '/count') {
		res.setHeader('content-type', 'application/json');
		res.end(JSON.stringify({ queries }));
	} else res.writeHead(404).end();
});
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
	const pg = net.connect(PG);
	let started = false;
	let buf = Buffer.alloc(0);
	// count frontend messages: after the startup packet each is 1 type byte + int32 length
	const count = (chunk) => {
		buf = Buffer.concat([buf, chunk]);
		for (;;) {
			if (!started) {
				if (buf.length < 8) return;
				const len = buf.readInt32BE(0);
				if (buf.length < len) return;
				const code = buf.readInt32BE(4);
				buf = buf.subarray(len);
				if (code !== 80877103) started = true; // SSLRequest is followed by the real startup
				continue;
			}
			if (buf.length < 5) return;
			const type = String.fromCharCode(buf[0]);
			const len = buf.readInt32BE(1);
			if (buf.length < len + 1) return;
			if (type === 'P' || type === 'Q') {
				queries++;
				// the SQL text: after the statement name (P) or straight away (Q)
				const body = buf.subarray(5, len + 1);
				const start = type === 'P' ? body.indexOf(0) + 1 : 0;
				log.push(body.subarray(start, body.indexOf(0, start)).toString().slice(0, 400));
			}
			buf = buf.subarray(len + 1);
		}
	};
	ws.on('message', (data) => {
		const b = Buffer.isBuffer(data) ? data : Buffer.from(data);
		count(b);
		pg.write(b);
	});
	pg.on('data', (d) => ws.readyState === 1 && ws.send(d));
	pg.on('close', () => ws.close());
	pg.on('error', () => ws.close());
	ws.on('close', () => pg.end());
});

server.listen(8099, '127.0.0.1', () => console.log('wsproxy on 127.0.0.1:8099'));
