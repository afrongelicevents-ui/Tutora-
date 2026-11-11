// Prepares Cloudflare with only an API token: finds the account and makes sure a free
// workers.dev address exists. Writes CLOUDFLARE_ACCOUNT_ID and SITE_URL for the next steps.
// Env: CLOUDFLARE_API_TOKEN (required), CLOUDFLARE_ACCOUNT_ID (optional), WORKER_NAME.
import { appendFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const API = process.env.CF_API_BASE ?? 'https://api.cloudflare.com/client/v4';
const TOKEN = process.env.CLOUDFLARE_API_TOKEN?.trim();
const WORKER = process.env.WORKER_NAME ?? 'tutora';

async function cf(path, init = {}) {
	const res = await fetch(API + path, {
		...init,
		headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }
	});
	const body = await res.json().catch(() => ({}));
	return { ok: res.ok && body.success !== false, status: res.status, body };
}

function out(name, value) {
	if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, `${name}=${value}\n`);
	if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

async function main() {
	if (!TOKEN) throw new Error('CLOUDFLARE_API_TOKEN is missing');
	let account = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
	if (!account) {
		const r = await cf('/accounts?per_page=50');
		const list = r.body.result ?? [];
		if (!r.ok || list.length === 0)
			throw new Error(
				'The Cloudflare token cannot see any account. Create it with the "Edit Cloudflare Workers" template.'
			);
		if (list.length > 1) console.log(`Token sees ${list.length} accounts; using the first.`);
		account = list[0].id;
	}
	out('CLOUDFLARE_ACCOUNT_ID', account);

	let sub = await cf(`/accounts/${account}/workers/subdomain`);
	let name = sub.ok ? sub.body.result?.subdomain : undefined;
	if (!name) {
		// New accounts have no workers.dev address yet; make one.
		for (let i = 0; i < 3 && !name; i++) {
			const want = `tutora-${randomBytes(3).toString('hex')}`;
			const r = await cf(`/accounts/${account}/workers/subdomain`, {
				method: 'PUT',
				body: JSON.stringify({ subdomain: want })
			});
			if (r.ok) name = r.body.result?.subdomain ?? want;
			else console.log(`Could not create workers.dev address (${r.status}).`);
		}
	}
	if (!name)
		throw new Error(
			'No workers.dev address. Open Workers & Pages in Cloudflare once, then run again.'
		);
	const url = `https://${WORKER}.${name}.workers.dev`;
	out('SITE_URL', url);
	console.log(`Website address: ${url}`);
}

main().catch((e) => {
	console.log(`::error::${e.message}`);
	process.exit(1);
});
